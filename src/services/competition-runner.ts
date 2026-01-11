import { nanoid } from 'nanoid';
import type { Services } from '../types/services.js';
import type { Competition, Issue, Solution, AgentStatus, PaymentRecord } from '../types/index.js';
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
  async createCompetition(issue: Issue, bountyAmount?: number): Promise<Competition> {
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

    // Phase 1.5: RAG - Query relevant code
    let relevantCode: CodeChunk[] = [];
    try {
      await this.emitEvent({
        type: 'rag:indexing',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: {
          repoUrl: competition.issue.repoUrl,
          message: `Searching for relevant code in ${competition.issue.repoUrl}...`,
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
      log('warn', 'CompetitionRunner', `RAG query failed: ${error}`);
      await this.emitEvent({
        type: 'rag:complete',
        competitionId: competition.id,
        timestamp: Date.now(),
        payload: {
          chunksFound: 0,
          message: `RAG query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          });
        } else {
          code = await llm.generateSolution(prompt, agentConfig.model);
        }

        const solution: Solution = {
          agentId: agentConfig.id,
          code,
          timeMs: Date.now() - startTime,
          success: true,
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
            await this.emitEvent({
              type: 'competition:completed',
              competitionId: competition.id,
              timestamp: Date.now(),
              payload: {
                competition: finalComp!,
                winner: reviewResult.winnerId,
                txHash,
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
            await this.emitEvent({
              type: 'competition:completed',
              competitionId: competition.id,
              timestamp: Date.now(),
              payload: {
                competition: finalComp!,
                winner: reviewResult.winnerId,
                error: errorMsg,
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
          await this.emitEvent({
            type: 'competition:completed',
            competitionId: competition.id,
            timestamp: Date.now(),
            payload: {
              competition: finalComp!,
              winner: reviewResult.winnerId,
              error: 'No wallet address configured',
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
## Instructions

Provide a complete code solution to fix this issue. Your solution should:
1. Address the problem described in the issue
2. Be well-structured and follow best practices
3. Include any necessary imports or dependencies
`;

    return prompt;
  }

  /**
   * Calculate bounty based on issue (random for testnet)
   */
  private calculateBounty(issue: Issue): number {
    const min = 0.01;
    const max = 0.05;
    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
  }

  /**
   * Helper for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default CompetitionRunner;
