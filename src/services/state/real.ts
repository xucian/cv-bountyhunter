import type { IStateStore } from '../../types/services.js';
import type { Competition } from '../../types/index.js';

export class RealStateStore implements IStateStore {
  async saveCompetition(competition: Competition): Promise<void> {
    throw new Error('RealStateStore.saveCompetition() not implemented');
  }

  async getCompetition(id: string): Promise<Competition | null> {
    throw new Error('RealStateStore.getCompetition() not implemented');
  }

  async updateCompetition(
    id: string,
    updates: Partial<Competition>
  ): Promise<void> {
    throw new Error('RealStateStore.updateCompetition() not implemented');
  }

  async listCompetitions(): Promise<Competition[]> {
    throw new Error('RealStateStore.listCompetitions() not implemented');
  }
}
