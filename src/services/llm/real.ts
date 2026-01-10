import type { ILLMService } from '../../types/services.js';

export class RealLLMService implements ILLMService {
  async generateSolution(prompt: string, model: string): Promise<string> {
    throw new Error('RealLLMService.generateSolution() not implemented');
  }
}
