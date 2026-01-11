import { nanoid } from 'nanoid';
import type { Services } from '../types/services.js';
import type { Competition, Issue, AgentStatus, SolveTask, Solution, PaymentRecord } from '../types/index.js';
import type { CodeChunk } from '../types/services.js';
import { config } from '../config.js';

export class Orchestrator {
  constructor(private services: Services) {}

  /**
   * Start a new competition for a GitHub issue
   * Fetches issue, indexes repo, creates competition, runs agents, picks winner, pays them
   */
  async startCompetition(repoUrl: string, issueNumber: number): Promise<Competition> {
    console.log('[Orchestrator] ========================================');
    console.log('[Orchestrator] START COMPETITION CALLED');
    console.log('[Orchestrator] Repo:', repoUrl);
    console.log('[Orchestrator] Issue #:', issueNumber);
    console.log('[Orchestrator] ========================================');

    // 1. Fetch issue from GitHub
    console.log('[Orchestrator] Fetching issue from GitHub...');
    const issue = await this.services.github.getIssue(repoUrl, issueNumber);
    console.log('[Orchestrator] Issue fetched:', issue.title);

    // 2. Index repository FIRST (fail fast pattern - if indexing fails, no competition is created)
    const currentDir = process.cwd();
    console.log(`[Orchestrator] Indexing repository at ${currentDir}`);

    const { commitId, chunksIndexed } = await this.services.rag.indexRepo(currentDir, repoUrl);
    console.log(`[Orchestrator] Repository indexed: ${chunksIndexed} chunks (commit: ${commitId})`);

    // 3. Query relevant code context
    console.log(`[Orchestrator] Querying relevant code for issue...`);
    const relevantChunks = await this.services.rag.queryRelevantCode(issue, config.rag.chunkLimit);
    const codeContext = this.formatCodeContext(relevantChunks);
    console.log(`[Orchestrator] Retrieved ${relevantChunks.length} relevant code chunks`);

    // 4. Create initial competition state (only after successful indexing)
    const competition: Competition = {
      id: nanoid(),
      issue,
      bountyAmount: this.calculateBounty(issue),
      status: 'pending',
      agents: this.initializeAgentStatuses(),
      createdAt: Date.now(),
    };

    // 5. Save competition to state store
    await this.services.state.saveCompetition(competition);

    // 6. Update status to running and execute agents
    await this.services.state.updateCompetition(competition.id, { status: 'running' });
    competition.status = 'running';

    // 7. Run all agents in parallel (with code context)
    await this.runAgents(competition, codeContext);

    // 6. Review solutions and pick winner
    await this.services.state.updateCompetition(competition.id, { status: 'judging' });
    competition.status = 'judging';

    const reviewResult = await this.reviewAndPickWinner(competition);
    competition.reviewResult = reviewResult;
    competition.winner = reviewResult.winnerId ?? undefined;

    await this.services.state.updateCompetition(competition.id, {
      reviewResult,
      winner: reviewResult.winnerId ?? undefined,
    });

    if (reviewResult.winnerId) {
      await this.payWinner(competition);
    }

    // 7. Mark competition as completed
    const completedAt = Date.now();
    await this.services.state.updateCompetition(competition.id, {
      status: 'completed',
      completedAt,
    });
    competition.status = 'completed';
    competition.completedAt = completedAt;

    return competition;
  }

  /**
   * Run all agents in parallel and update their statuses as they complete
   */
  private async runAgents(competition: Competition, codeContext?: string): Promise<void> {
    const agentPromises = config.agents.map(async (agentConfig) => {
      const agentStatus = competition.agents.find((a) => a.id === agentConfig.id);
      if (!agentStatus) return;

      // Mark agent as solving
      agentStatus.status = 'solving';
      agentStatus.startedAt = Date.now();
      await this.services.state.updateAgentStatus(competition.id, agentStatus);

      try {
        // Build the agent URL
        const agentUrl = `http://localhost:${agentConfig.port}/solve`;

        // Create the solve task with code context
        const task: SolveTask = {
          agentId: agentConfig.id,
          issue: competition.issue,
          codeContext, // Include RAG-retrieved context
        };

        // Call the agent
        const solution = await this.services.agentClient.callAgent(agentUrl, task);

        // Update agent status with solution
        agentStatus.status = solution.success ? 'done' : 'failed';
        agentStatus.solution = solution;
        agentStatus.completedAt = Date.now();
        await this.services.state.updateAgentStatus(competition.id, agentStatus);
      } catch (error) {
        // Handle agent failure
        agentStatus.status = 'failed';
        agentStatus.completedAt = Date.now();
        await this.services.state.updateAgentStatus(competition.id, agentStatus);

        console.error(`Agent ${agentConfig.id} failed:`, error);
      }
    });

    // Wait for all agents to complete
    await Promise.all(agentPromises);
  }

  /**
   * Review all solutions and pick the winner using the reviewer service
   */
  private async reviewAndPickWinner(competition: Competition) {
    // Collect all solutions from agents
    const solutions: Solution[] = competition.agents
      .filter((agent) => agent.solution)
      .map((agent) => agent.solution!);

    console.log(`[Orchestrator] Reviewing ${solutions.length} solutions...`);

    // Use the reviewer service to evaluate solutions
    const reviewResult = await this.services.reviewer.reviewSolutions(
      competition.issue,
      solutions
    );

    console.log(`[Orchestrator] Review complete. Winner: ${reviewResult.winnerId ?? 'none'}`);
    console.log(`[Orchestrator] Summary: ${reviewResult.summary}`);

    return reviewResult;
  }

  /**
   * Pay the winner their bonus with full payment tracking
   */
  private async payWinner(competition: Competition): Promise<void> {
    if (!competition.winner) return;

    // Find the winning agent's wallet address
    const agentConfig = config.agents.find((a) => a.id === competition.winner);
    if (!agentConfig?.walletAddress) {
      console.error(`[Orchestrator] No wallet address found for winner: ${competition.winner}`);
      return;
    }

    // Create payment record
    const paymentRecord: PaymentRecord = {
      id: nanoid(),
      competitionId: competition.id,
      agentId: competition.winner,
      walletAddress: agentConfig.walletAddress,
      amount: competition.bountyAmount,
      txHash: '',
      status: 'pending',
      network: config.x402.network,
      createdAt: Date.now(),
    };

    try {
      // Check balance before sending (if supported)
      if (this.services.payment.getBalance) {
        const balance = await this.services.payment.getBalance();
        console.log(`[Orchestrator] Current wallet balance: ${balance} USDC`);

        if (balance < competition.bountyAmount) {
          paymentRecord.status = 'failed';
          paymentRecord.error = `Insufficient balance: ${balance} < ${competition.bountyAmount}`;
          console.error(`[Orchestrator] ${paymentRecord.error}`);

          // Save failed payment record
          await this.savePaymentRecord(paymentRecord);
          throw new Error(paymentRecord.error);
        }
      }

      console.log(`[Orchestrator] Sending ${competition.bountyAmount} USDC to ${competition.winner}...`);

      // Send bonus payment to winner
      const txHash = await this.services.payment.sendBonus(
        agentConfig.walletAddress,
        competition.bountyAmount
      );

      // Update payment record with success
      paymentRecord.txHash = txHash;
      paymentRecord.status = 'confirmed';
      paymentRecord.confirmedAt = Date.now();

      console.log(`[Orchestrator] Payment successful!`);
      console.log(`[Orchestrator] TX Hash: ${txHash}`);
      console.log(`[Orchestrator] Explorer: https://${config.x402.network === 'base' ? '' : 'sepolia.'}basescan.org/tx/${txHash}`);

      // Save successful payment record
      await this.savePaymentRecord(paymentRecord);

      // Update competition with payment record
      competition.paymentRecord = paymentRecord;
      await this.services.state.updateCompetition(competition.id, {
        paymentRecord,
      });

    } catch (error) {
      // Update payment record with failure
      if (paymentRecord.status !== 'failed') {
        paymentRecord.status = 'failed';
        paymentRecord.error = error instanceof Error ? error.message : 'Unknown error';
      }

      console.error(`[Orchestrator] Payment failed for ${competition.winner}:`, error);

      // Save failed payment record
      await this.savePaymentRecord(paymentRecord);

      // Still update competition with failed payment info
      competition.paymentRecord = paymentRecord;
      await this.services.state.updateCompetition(competition.id, {
        paymentRecord,
      });
    }
  }

  /**
   * Save a payment record to the state store (if supported)
   */
  private async savePaymentRecord(record: PaymentRecord): Promise<void> {
    try {
      // Check if state store supports payment records
      const stateStore = this.services.state as any;
      if (typeof stateStore.savePaymentRecord === 'function') {
        await stateStore.savePaymentRecord(record);
        console.log(`[Orchestrator] Payment record saved: ${record.id}`);
      }
    } catch (error) {
      // Don't fail the payment if we can't save the record
      console.warn('[Orchestrator] Failed to save payment record:', error);
    }
  }

  /**
   * Get payment statistics (if using real state store)
   */
  async getPaymentStats(): Promise<{
    walletAddress?: string;
    walletBalance?: number;
    totalPaid?: number;
    network: string;
  }> {
    const stats: any = {
      network: config.x402.network,
    };

    try {
      // Get wallet info if available
      if (this.services.payment.getWalletAddress) {
        stats.walletAddress = await this.services.payment.getWalletAddress();
      }
      if (this.services.payment.getBalance) {
        stats.walletBalance = await this.services.payment.getBalance();
      }

      // Get total paid from state store if available
      const stateStore = this.services.state as any;
      if (typeof stateStore.getPaymentStats === 'function') {
        const paymentStats = await stateStore.getPaymentStats();
        stats.totalPaid = paymentStats.totalAmount;
      }
    } catch (error) {
      console.warn('[Orchestrator] Failed to get payment stats:', error);
    }

    return stats;
  }

  /**
   * Get a competition by ID
   */
  async getCompetition(id: string): Promise<Competition | null> {
    return this.services.state.getCompetition(id);
  }

  /**
   * Initialize agent statuses from config
   */
  private initializeAgentStatuses(): AgentStatus[] {
    return config.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      status: 'idle' as const,
    }));
  }

  /**
   * Calculate bounty amount based on issue labels/complexity
   * Default: 10 USDC, can be increased based on labels
   */
  private calculateBounty(issue: Issue): number {
    const baseBounty = 10;

    // Check for bounty-related labels
    const labels = issue.labels.map((l) => l.toLowerCase());

    if (labels.includes('bounty-high') || labels.includes('high-priority')) {
      return 50;
    }
    if (labels.includes('bounty-medium') || labels.includes('enhancement')) {
      return 25;
    }
    if (labels.includes('bug')) {
      return 15;
    }

    return baseBounty;
  }

  /**
   * Format code chunks into context string for agents
   */
  private formatCodeContext(chunks: CodeChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant code context found.';
    }

    let context = '# Relevant Code Context\n\n';
    context += `Found ${chunks.length} relevant code sections:\n\n`;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      context += `## ${i + 1}. ${chunk.chunkName} (${chunk.chunkType})\n`;
      context += `**File**: ${chunk.filePath}\n`;
      if (chunk.score) {
        context += `**Relevance**: ${(chunk.score * 100).toFixed(1)}%\n`;
      }
      context += `\`\`\`typescript\n${chunk.code}\n\`\`\`\n\n`;
    }

    // Safety: Truncate if context is too large
    const MAX_CONTEXT_CHARS = 50000;
    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.slice(0, MAX_CONTEXT_CHARS) + '\n\n... (truncated for size)';
    }

    return context;
  }
}
