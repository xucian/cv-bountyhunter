import type { IAgentClient } from '../../types/services.js';
import type { Solution, SolveTask, Issue, TaskEvaluation } from '../../types/index.js';

export class RealAgentClient implements IAgentClient {
  async evaluateAgent(
    agentUrl: string,
    issue: Issue,
    bountyAmount: number
  ): Promise<TaskEvaluation & { agentId: string }> {
    // Replace /solve with /evaluate in the URL
    const evaluateUrl = agentUrl.replace('/solve', '/evaluate');

    const response = await fetch(evaluateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue, bountyAmount }),
    });

    if (!response.ok) {
      throw new Error(`Agent evaluation failed: ${response.statusText}`);
    }

    return response.json();
  }

  async callAgent(agentUrl: string, task: SolveTask): Promise<Solution> {
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: task.issue }),
    });

    if (!response.ok) {
      throw new Error(`Agent call failed: ${response.statusText}`);
    }

    return response.json();
  }
}
