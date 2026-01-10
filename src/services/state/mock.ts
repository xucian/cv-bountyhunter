import type { IStateStore } from '../../types/services.js';
import type { Competition, AgentStatus, PaymentRecord } from '../../types/index.js';

export class MockStateStore implements IStateStore {
  private competitions: Map<string, Competition> = new Map();
  private payments: Map<string, PaymentRecord> = new Map();

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

  async updateAgentStatus(
    competitionId: string,
    agentStatus: AgentStatus
  ): Promise<void> {
    console.log(`[MockState] Updating agent ${agentStatus.id} in competition: ${competitionId}`);
    const existing = this.competitions.get(competitionId);

    if (!existing) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    const agentIndex = existing.agents.findIndex((a) => a.id === agentStatus.id);
    if (agentIndex === -1) {
      throw new Error(`Agent not found: ${agentStatus.id}`);
    }

    // Update only the specific agent
    const updatedAgents = [...existing.agents];
    updatedAgents[agentIndex] = agentStatus;

    this.competitions.set(competitionId, { ...existing, agents: updatedAgents });
  }

  async listCompetitions(): Promise<Competition[]> {
    console.log(`[MockState] Listing all competitions`);
    return Array.from(this.competitions.values()).map((c) => ({ ...c }));
  }

  async savePaymentRecord(record: PaymentRecord): Promise<void> {
    console.log(`[MockState] Saving payment record: ${record.id}`);
    this.payments.set(record.id, { ...record });
  }

  async getPaymentRecord(id: string): Promise<PaymentRecord | null> {
    console.log(`[MockState] Getting payment record: ${id}`);
    const record = this.payments.get(id);
    return record ? { ...record } : null;
  }

  // Helper for testing - clears all data
  clear(): void {
    this.competitions.clear();
    this.payments.clear();
  }
}
