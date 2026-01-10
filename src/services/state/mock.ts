import type { IStateStore } from '../../types/services.js';
import type { Competition } from '../../types/index.js';

export class MockStateStore implements IStateStore {
  private competitions: Map<string, Competition> = new Map();

  async saveCompetition(competition: Competition): Promise<void> {
    console.log(`[MockState] Saving competition: ${competition.id}`);
    this.competitions.set(competition.id, { ...competition });
  }

  async getCompetition(id: string): Promise<Competition | null> {
    console.log(`[MockState] Getting competition: ${id}`);
    const competition = this.competitions.get(id);
    return competition ? { ...competition } : null;
  }

  async updateCompetition(
    id: string,
    updates: Partial<Competition>
  ): Promise<void> {
    console.log(`[MockState] Updating competition: ${id}`);
    const existing = this.competitions.get(id);

    if (!existing) {
      throw new Error(`Competition not found: ${id}`);
    }

    this.competitions.set(id, { ...existing, ...updates });
  }

  async listCompetitions(): Promise<Competition[]> {
    console.log(`[MockState] Listing all competitions`);
    return Array.from(this.competitions.values()).map((c) => ({ ...c }));
  }

  // Helper for testing - clears all data
  clear(): void {
    this.competitions.clear();
  }
}
