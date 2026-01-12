import { nanoid } from 'nanoid';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import type { Services } from '../types/services.js';
import type { Competition, Issue, Solution, AgentStatus, PaymentRecord, FileChange } from '../types/index.js';
import type { CompetitionEvent } from '../types/events.js';
import type { CodeChunk } from '../types/services.js';
import { config } from '../config.js';
import { log } from '../utils/logger.js';

/**
 * CompetitionRunner orchestrates the full competition lifecycle:
 * 1. Create competition from issue
 * 2. Run all agents in parallel
 * 3. Judge solutions with reviewer
 * 4. Pay winner via X402
 *
 * Emits events at each stage for real-time updates via WebSocket.
 */
export class CompetitionRunner {
  constructor(private services: Services) {}

  /**
   * Create a new competition from an issue
   */
  async createCompetition(issue: Issue, bountyAmount?: number, autoCreatePR?: boolean): Promise<Competition> {
    const amount = bountyAmount ?? this.calculateBounty(issue);

    const competition: Competition = {
      id: nanoid(),
      issue,
      bountyAmount: amount,
      status: 'pending',
      agents: config.agents.map((agentConfig) => ({
        id: agentConfig.id,
        name: agentConfig.name,
        status: 'idle' as const,
      })),
      autoCreatePR: autoCreatePR ?? false,
      createdAt: Date.now(),
    };

    // Save to state store
    await this.services.state.saveCompetition(competition);

    // Emit creation event
    await this.emitEvent({
      type: 'competition:created',
      competitionId: competition.id,
      timestamp: Date.now(),
      payload: { competition },
    });

    return competition;
  }

  /**
   * Run a competition through all phases
   * Returns the final competition state
   */
  async run(competition: Competition): Promise<Competition> {
    const { state, llm, reviewer, payment, events, rag } = this.services;

    log('info', 'CompetitionRunner', `Starting competition ${competition.id}`);

    // Phase 1: Start competition
    await this.delay(300);
    await state.updateCompetition(competition.id, { status: 'running' });

    await this.emitEvent({
      type: 'competition:started',
      competitionId: competition.id,
      timestamp: Date.now(),
      payload: { competition: { ...competition, status: 'running' } },
    });

    // Phase 1.5: RAG - Clone, Index, and Query relevant code
    let relevantCode: CodeChunk[] = [];
    try {
      // Step 1: Clone repository
      await this.emitEvent({
        type: 'rag:indexing',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: {
          repoUrl: competition.issue.repoUrl,
          message: `Cloning repository ${competition.issue.repoUrl}...`,
        },
      });

      log('info', 'CompetitionRunner', `Cloning repository: ${competition.issue.repoUrl}`);
      const repoPath = await this.cloneRepository(competition.issue.repoUrl);
      log('info', 'CompetitionRunner', `Repository cloned to: ${repoPath}`);

      // Step 2: Index repository
      await this.emitEvent({
        type: 'rag:indexing',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: {
          repoUrl: competition.issue.repoUrl,
          message: `Indexing repository code...`,
        },
      });

      log('info', 'CompetitionRunner', `Indexing repository: ${repoPath}`);
      const { commitId, chunksIndexed } = await rag.indexRepo(
        repoPath,
        competition.issue.repoUrl,
        (stage, message, current, total) => {
          this.emitEvent({
            type: 'rag:progress',
            competitionId: competition.id,
            timestamp: Date.now(),
            payload: { stage, message, current, total },
          });
        }
      );

      log('info', 'CompetitionRunner', `Indexed ${chunksIndexed} chunks (commit: ${commitId})`);

      await this.emitEvent({
        type: 'rag:indexing',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: {
          repoUrl: competition.issue.repoUrl,
          message: `Indexed ${chunksIndexed} code chunks from commit ${commitId.slice(0, 8)}`,
        },
      });

      // Step 3: Query relevant code
      await this.emitEvent({
        type: 'rag:indexing',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: {
          repoUrl: competition.issue.repoUrl,
          message: `Searching for relevant code...`,
        },
      });

      relevantCode = await rag.queryRelevantCode(
        competition.issue,
        10,
        (stage, message, current, total) => {
          this.emitEvent({
            type: 'rag:progress',
            competitionId: competition.id,
            timestamp: Date.now(),
            payload: { stage, message, current, total },
          });
        }
      );

      await this.emitEvent({
        type: 'rag:complete',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: {
          chunksFound: relevantCode.length,
          message: `Found ${relevantCode.length} relevant code chunks`,
        },
      });

      log('info', 'CompetitionRunner', `Found ${relevantCode.length} relevant code chunks`);
    } catch (error) {
      log('warn', 'CompetitionRunner', `RAG failed: ${error}`);
      await this.emitEvent({
        type: 'rag:complete',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: {
          chunksFound: 0,
          message: `RAG failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
    }

    // Phase 2: Start all agents
    const startedAt = Date.now();
    for (const agent of competition.agents) {
      const agentUpdate: AgentStatus = {
        ...agent,
        status: 'solving',
        startedAt,
      };
      await state.updateAgentStatus(competition.id, agentUpdate);

      await this.emitEvent({
        type: 'agent:solving',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: { agentId: agent.id, agentName: agent.name },
      });
    }

    // Phase 3: Run all agents in parallel with streaming
    const agentPromises = config.agents.map(async (agentConfig) => {
      const startTime = Date.now();

      try {
        const prompt = this.buildPrompt(competition.issue, relevantCode);

        // Use streaming if available
        let code: string;
        if (llm.generateSolutionStreaming) {
          code = await llm.generateSolutionStreaming(prompt, agentConfig.model, (chunk, accumulated) => {
            // Emit streaming event
            this.emitEvent({
              type: 'agent:streaming',
              competitionId: competition.id,
              timestamp: Date.now(),
              payload: {
                agentId: agentConfig.id,
                agentName: agentConfig.name,
                chunk,
                accumulated,
              },
            });
          }, agentConfig.provider);
        } else {
          code = await llm.generateSolution(prompt, agentConfig.model, agentConfig.provider);
        }

        // Parse structured file changes from the response
        const fileChanges = this.parseFileChanges(code);
        const explanation = this.extractExplanation(code);

        const solution: Solution = {
          agentId: agentConfig.id,
          code,
          fileChanges,
          explanation,
          timeMs: Date.now() - startTime,
          success: fileChanges.length > 0,
        };

        const agentUpdate: AgentStatus = {
          id: agentConfig.id,
          name: agentConfig.name,
          status: 'done',
          completedAt: Date.now(),
          solution,
          startedAt: startTime,
        };
        await state.updateAgentStatus(competition.id, agentUpdate);

        await this.emitEvent({
          type: 'agent:done',
          competitionId: competition.id,
          timestamp: Date.now(),
          payload: { agentId: agentConfig.id, agentName: agentConfig.name, solution },
        });

        return solution;
      } catch (error) {
        log('error', 'CompetitionRunner', `Agent ${agentConfig.id} failed: ${error}`);

        const agentUpdate: AgentStatus = {
          id: agentConfig.id,
          name: agentConfig.name,
          status: 'failed',
          completedAt: Date.now(),
          startedAt: startTime,
        };
        await state.updateAgentStatus(competition.id, agentUpdate);

        await this.emitEvent({
          type: 'agent:failed',
          competitionId: competition.id,
          timestamp: Date.now(),
          payload: {
            agentId: agentConfig.id,
            agentName: agentConfig.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        return null;
      }
    });

    const results = await Promise.all(agentPromises);

    // Phase 4: Judging with streaming
    await this.delay(300);
    await state.updateCompetition(competition.id, { status: 'judging' });

    await this.emitEvent({
      type: 'competition:judging',
      competitionId: competition.id,
      timestamp: Date.now(),
      payload: {},
    });

    const successfulSolutions = results.filter((r): r is Solution => r !== null && r.success);

    if (successfulSolutions.length > 0) {
      // Use streaming reviewer if available
      let reviewResult;
      if (reviewer.reviewSolutionsStreaming) {
        reviewResult = await reviewer.reviewSolutionsStreaming(
          competition.issue,
          successfulSolutions,
          (chunk, accumulated) => {
            this.emitEvent({
              type: 'judging:streaming',
              competitionId: competition.id,
              timestamp: Date.now(),
              payload: { chunk, accumulated },
            });
          }
        );
      } else {
        reviewResult = await reviewer.reviewSolutions(competition.issue, successfulSolutions);
      }

      await this.delay(500);

      if (reviewResult.winnerId) {
        // Phase 5: Payment
        await state.updateCompetition(competition.id, {
          status: 'paying',
          winner: reviewResult.winnerId,
          reviewResult,
        });

        await this.emitEvent({
          type: 'competition:paying',
          competitionId: competition.id,
          timestamp: Date.now(),
          payload: { winner: reviewResult.winnerId, reviewResult },
        });

        await this.delay(300);

        // Find winner's wallet
        const winnerConfig = config.agents.find((a) => a.id === reviewResult.winnerId);
        const walletAddress = winnerConfig?.walletAddress;

        if (walletAddress) {
          // Create payment record
          const paymentRecord: PaymentRecord = {
            id: nanoid(),
            competitionId: competition.id,
            agentId: reviewResult.winnerId,
            walletAddress,
            amount: competition.bountyAmount,
            txHash: '',
            status: 'pending',
            network: config.x402?.network || 'base-sepolia',
            createdAt: Date.now(),
          };

          try {
            const txHash = await payment.sendBonus(walletAddress, competition.bountyAmount);

            paymentRecord.txHash = txHash;
            paymentRecord.status = 'confirmed';
            paymentRecord.confirmedAt = Date.now();

            await state.savePaymentRecord(paymentRecord);

            await state.updateCompetition(competition.id, {
              status: 'completed',
              winner: reviewResult.winnerId,
              paymentTxHash: txHash,
              paymentRecord,
              completedAt: Date.now(),
            });

            const finalComp = await state.getCompetition(competition.id);

            // Auto-create PR if enabled
            let prUrl: string | undefined;
            log('info', 'CompetitionRunner', `Checking auto-create PR: autoCreatePR=${competition.autoCreatePR}, type=${typeof competition.autoCreatePR}, strict check=${competition.autoCreatePR === true}`);
            if (competition.autoCreatePR === true) {
              try {
                const winningSolution = successfulSolutions.find(s => s.agentId === reviewResult.winnerId);
                if (winningSolution) {
                  log('info', 'CompetitionRunner', `Auto-creating PR for winning solution (autoCreatePR=${competition.autoCreatePR})`);
                  prUrl = await this.services.github.createSolutionPR(
                    competition.issue,
                    winningSolution,
                    winnerConfig?.name || reviewResult.winnerId,
                    false // Include explanation
                  );
                  log('info', 'CompetitionRunner', `PR created: ${prUrl}`);
                  await state.updateCompetition(competition.id, { prUrl });
                }
              } catch (error) {
                log('error', 'CompetitionRunner', `Failed to auto-create PR: ${error}`);
              }
            }

            await this.emitEvent({
              type: 'competition:completed',
              competitionId: competition.id,
              timestamp: Date.now(),
              payload: {
                competition: finalComp!,
                winner: reviewResult.winnerId,
                txHash,
                prUrl,
              },
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Payment failed';
            log('error', 'CompetitionRunner', `Payment failed: ${errorMsg}`);

            paymentRecord.status = 'failed';
            paymentRecord.error = errorMsg;
            await state.savePaymentRecord(paymentRecord);

            await state.updateCompetition(competition.id, {
              status: 'completed',
              winner: reviewResult.winnerId,
              paymentError: errorMsg,
              paymentRecord,
              completedAt: Date.now(),
            });

            const finalComp = await state.getCompetition(competition.id);

            // Auto-create PR if enabled (even if payment failed)
            let prUrl: string | undefined;
            if (competition.autoCreatePR === true) {
              try {
                const winningSolution = successfulSolutions.find(s => s.agentId === reviewResult.winnerId);
                if (winningSolution) {
                  log('info', 'CompetitionRunner', `Auto-creating PR for winning solution (autoCreatePR=${competition.autoCreatePR})`);
                  prUrl = await this.services.github.createSolutionPR(
                    competition.issue,
                    winningSolution,
                    winnerConfig?.name || reviewResult.winnerId,
                    false // Include explanation
                  );
                  log('info', 'CompetitionRunner', `PR created: ${prUrl}`);
                  await state.updateCompetition(competition.id, { prUrl });
                }
              } catch (error) {
                log('error', 'CompetitionRunner', `Failed to auto-create PR: ${error}`);
              }
            }

            await this.emitEvent({
              type: 'competition:completed',
              competitionId: competition.id,
              timestamp: Date.now(),
              payload: {
                competition: finalComp!,
                winner: reviewResult.winnerId,
                error: errorMsg,
                prUrl,
              },
            });
          }
        } else {
          // No wallet configured
          await state.updateCompetition(competition.id, {
            status: 'completed',
            winner: reviewResult.winnerId,
            paymentError: 'No wallet address configured',
            completedAt: Date.now(),
          });

          const finalComp = await state.getCompetition(competition.id);

          // Auto-create PR if enabled (even with no wallet)
          let prUrl: string | undefined;
          if (competition.autoCreatePR === true) {
            try {
              const winningSolution = successfulSolutions.find(s => s.agentId === reviewResult.winnerId);
              if (winningSolution) {
                log('info', 'CompetitionRunner', `Auto-creating PR for winning solution (autoCreatePR=${competition.autoCreatePR})`);
                prUrl = await this.services.github.createSolutionPR(
                  competition.issue,
                  winningSolution,
                  winnerConfig?.name || reviewResult.winnerId,
                  false // Include explanation
                );
                log('info', 'CompetitionRunner', `PR created: ${prUrl}`);
                await state.updateCompetition(competition.id, { prUrl });
              }
            } catch (error) {
              log('error', 'CompetitionRunner', `Failed to auto-create PR: ${error}`);
            }
          }

          await this.emitEvent({
            type: 'competition:completed',
            competitionId: competition.id,
            timestamp: Date.now(),
            payload: {
              competition: finalComp!,
              winner: reviewResult.winnerId,
              error: 'No wallet address configured',
              prUrl,
            },
          });
        }
      } else {
        // No winner selected
        await state.updateCompetition(competition.id, {
          status: 'completed',
          reviewResult,
          completedAt: Date.now(),
        });

        const finalComp = await state.getCompetition(competition.id);
        await this.emitEvent({
          type: 'competition:completed',
          competitionId: competition.id,
          timestamp: Date.now(),
          payload: { competition: finalComp! },
        });
      }
    } else {
      // No successful solutions
      await this.delay(500);
      await state.updateCompetition(competition.id, {
        status: 'completed',
        completedAt: Date.now(),
      });

      const finalComp = await state.getCompetition(competition.id);
      await this.emitEvent({
        type: 'competition:completed',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: { competition: finalComp! },
      });
    }

    return (await state.getCompetition(competition.id))!;
  }

  /**
   * Helper to emit events
   */
  private async emitEvent(event: CompetitionEvent): Promise<void> {
    await this.services.events.emit(event);
  }

  /**
   * Build prompt from issue with relevant code context
   */
  private buildPrompt(issue: Issue, relevantCode: CodeChunk[] = []): string {
    let prompt = `Fix this GitHub issue:

Title: ${issue.title}

Description:
${issue.body}
`;

    // Add relevant code context if available
    if (relevantCode.length > 0) {
      prompt += `
## Relevant Code Context

The following code snippets from the codebase may be relevant to this issue:

`;
      for (const chunk of relevantCode) {
        prompt += `### ${chunk.filePath} - ${chunk.chunkType}: ${chunk.chunkName}
\`\`\`typescript
${chunk.code}
\`\`\`

`;
      }
    }

    prompt += `
## Task

Provide a complete solution that fixes this issue. You MUST respond in the following XML format:

<solution>
  <explanation>Brief explanation of the fix</explanation>
  <files>
    <file>
      <path>relative/path/from/repo/root.ts</path>
      <action>modify</action>
      <content>
complete file content here
      </content>
    </file>
    <!-- Add more <file> blocks as needed -->
  </files>
</solution>

Important:
- <path> must be relative from repository root (e.g., "src/components/Button.tsx")
- <action> must be "create", "modify", or "delete"
- <content> must be the COMPLETE file content (not a diff)
- For new files, use action="create"
- For existing files, use action="modify"
- Include ALL files that need changes
`;

    return prompt;
  }

  /**
   * Calculate bounty based on issue (random for testnet)
   */
  private calculateBounty(_issue: Issue): number {
    const min = 0.01;
    const max = 0.05;
    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
  }

  /**
   * Clone a GitHub repository to a temporary directory
   * Uses a deterministic path based on repo name for caching
   */
  private async cloneRepository(repoUrl: string): Promise<string> {
    // Extract repo name from URL (e.g., "https://github.com/psf/requests" -> "psf-requests")
    const repoName = repoUrl
      .replace(/^https?:\/\//, '')
      .replace(/\.git$/, '')
      .replace(/github\.com\//, '')
      .replace(/\//g, '-');

    // Create temp directory for codebounty repos
    const codebountyDir = join(tmpdir(), 'codebounty-repos');
    if (!existsSync(codebountyDir)) {
      mkdirSync(codebountyDir, { recursive: true });
    }

    const repoPath = join(codebountyDir, repoName);

    // If repo already exists, pull latest changes instead of re-cloning
    if (existsSync(repoPath)) {
      log('info', 'CompetitionRunner', `Repository already exists, pulling latest changes...`);
      try {
        execSync('git pull', { cwd: repoPath, stdio: 'pipe' });
        return repoPath;
      } catch (error) {
        log('warn', 'CompetitionRunner', `Failed to pull, will re-clone: ${error}`);
        // If pull fails, remove and re-clone
        execSync(`rm -rf "${repoPath}"`, { stdio: 'pipe' });
      }
    }

    // Clone the repository
    log('info', 'CompetitionRunner', `Cloning fresh copy...`);
    execSync(`git clone --depth 1 "${repoUrl}" "${repoPath}"`, {
      stdio: 'pipe',
    });

    return repoPath;
  }

  /**
   * Helper for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse XML-formatted file changes from LLM response
   */
  private parseFileChanges(response: string): FileChange[] {
    const fileChanges: FileChange[] = [];

    // Extract all <file> blocks
    const fileBlockRegex = /<file>([\s\S]*?)<\/file>/g;
    let match;

    while ((match = fileBlockRegex.exec(response)) !== null) {
      const fileBlock = match[1];

      // Extract path
      const pathMatch = fileBlock.match(/<path>(.*?)<\/path>/);
      const path = pathMatch?.[1]?.trim();

      // Extract action
      const actionMatch = fileBlock.match(/<action>(create|modify|delete)<\/action>/);
      const action = actionMatch?.[1] as 'create' | 'modify' | 'delete';

      // Extract content
      const contentMatch = fileBlock.match(/<content>([\s\S]*?)<\/content>/);
      const content = contentMatch?.[1]?.trim() || '';

      if (path && action) {
        fileChanges.push({
          filePath: path,
          action,
          content,
        });
      }
    }

    // Fallback: If no XML found, try to extract code blocks
    if (fileChanges.length === 0) {
      log('warn', 'CompetitionRunner', 'No XML file blocks found, attempting fallback parsing');
      return this.fallbackParseCodeBlocks(response);
    }

    return fileChanges;
  }

  /**
   * Fallback: Extract code from markdown code blocks
   */
  private fallbackParseCodeBlocks(response: string): FileChange[] {
    const fileChanges: FileChange[] = [];

    // Look for patterns like "File: src/foo.ts" followed by code block
    const filePattern = /(?:File|file|Path|path):\s*([^\n]+)\n```[\w]*\n([\s\S]*?)```/g;
    let match;

    while ((match = filePattern.exec(response)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();

      fileChanges.push({
        filePath,
        action: 'modify', // Assume modify in fallback
        content,
      });
    }

    // If still nothing, create a single file with all code
    if (fileChanges.length === 0) {
      const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        fileChanges.push({
          filePath: 'solution.ts', // Generic filename
          action: 'create',
          content: codeBlockMatch[1].trim(),
        });
      }
    }

    return fileChanges;
  }

  /**
   * Extract explanation from XML response
   */
  private extractExplanation(response: string): string | undefined {
    const explanationMatch = response.match(/<explanation>([\s\S]*?)<\/explanation>/);
    return explanationMatch?.[1]?.trim();
  }
}

export default CompetitionRunner;
