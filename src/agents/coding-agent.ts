import type { ILLMService } from '../types/services.js';
import type { Issue, Solution, AgentConfig, TaskEvaluation, LLMProvider, FileChange } from '../types/index.js';

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

  async solve(issue: Issue, codeContext?: string): Promise<Solution> {
    const startTime = Date.now();

    const prompt = `Fix this GitHub issue:

# Issue Details
Title: ${issue.title}
Description: ${issue.body}
Repository: ${issue.repoUrl}
Labels: ${issue.labels.join(', ')}

${codeContext ? `# Relevant Code Context\n${codeContext}\n` : ''}
# Task
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
- Include ALL files that need changes`;

    try {
      const rawResponse = await this.llmService.generateSolution(prompt, this.model, this.provider);

      // Parse the structured response
      const fileChanges = this.parseFileChanges(rawResponse);
      const explanation = this.extractExplanation(rawResponse);

      return {
        agentId: this.agentId,
        code: rawResponse,
        fileChanges,
        explanation,
        timeMs: Date.now() - startTime,
        success: fileChanges.length > 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${this.agentId}] Failed to solve issue:`, errorMessage);

      return {
        agentId: this.agentId,
        code: '',
        fileChanges: [],
        timeMs: Date.now() - startTime,
        success: false,
      };
    }
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
      console.warn(`[${this.agentId}] No XML file blocks found, attempting fallback parsing`);
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

  getAgentId(): string {
    return this.agentId;
  }

  getModel(): string {
    return this.model;
  }
}
