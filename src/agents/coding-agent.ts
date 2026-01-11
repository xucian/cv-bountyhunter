import type { ILLMService } from '../types/services.js';
import type { Issue, Solution, AgentConfig, TaskEvaluation, LLMProvider } from '../types/index.js';

export class CodingAgent {
  constructor(
    private agentId: string,
    private model: string,
    private provider: LLMProvider,
    private llmService: ILLMService,
    private economics: Pick<AgentConfig, 'costPerToken' | 'avgTokensPerSolution' | 'minimumMargin'>
  ) {}

  /**
   * Evaluate whether this task is worth accepting at the given bounty
   */
  evaluateTask(issue: Issue, bountyAmount: number): TaskEvaluation {
    const estimatedCost = this.economics.avgTokensPerSolution * this.economics.costPerToken;
    const minPrice = estimatedCost * (1 + this.economics.minimumMargin);
    const accept = bountyAmount >= minPrice;

    const marginIfAccepted = ((bountyAmount - estimatedCost) / estimatedCost) * 100;

    return {
      accept,
      minPrice,
      estimatedCost,
      reason: accept
        ? `Accepting: $${bountyAmount.toFixed(4)} bounty, $${estimatedCost.toFixed(4)} cost, ${marginIfAccepted.toFixed(0)}% margin`
        : `Declining: Need $${minPrice.toFixed(4)} min, offered $${bountyAmount.toFixed(4)} (${this.economics.minimumMargin * 100}% margin required)`,
    };
  }

  async solve(issue: Issue): Promise<Solution> {
    const startTime = Date.now();

    const prompt = `Fix this GitHub issue:
Title: ${issue.title}
Description: ${issue.body}

Repository: ${issue.repoUrl}
Labels: ${issue.labels.join(', ')}

Provide a complete code solution that fixes this issue. Include:
1. The file(s) that need to be modified
2. The complete code changes
3. A brief explanation of the fix`;

    try {
      const code = await this.llmService.generateSolution(prompt, this.model, this.provider);
      return {
        agentId: this.agentId,
        code,
        timeMs: Date.now() - startTime,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${this.agentId}] Failed to solve issue:`, errorMessage);

      return {
        agentId: this.agentId,
        code: '',
        timeMs: Date.now() - startTime,
        success: false,
      };
    }
  }

  getAgentId(): string {
    return this.agentId;
  }

  getModel(): string {
    return this.model;
  }
}
