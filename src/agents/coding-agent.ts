import type { ILLMService } from '../types/services.js';
import type { Issue, Solution } from '../types/index.js';

export class CodingAgent {
  constructor(
    private agentId: string,
    private model: string,
    private llmService: ILLMService
  ) {}

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
      const code = await this.llmService.generateSolution(prompt, this.model);
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
