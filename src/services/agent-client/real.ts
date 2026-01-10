import type { IAgentClient } from '../../types/services.js';
import type { Solution, SolveTask } from '../../types/index.js';

export class RealAgentClient implements IAgentClient {
  async callAgent(agentUrl: string, task: SolveTask): Promise<Solution> {
    throw new Error('RealAgentClient.callAgent() not implemented');
  }
}
