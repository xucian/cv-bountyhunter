/**
 * MongoDB State Store
 * Persists competitions and payment records to MongoDB
 */

import { MongoClient, type Db, type Collection } from 'mongodb';
import type { IStateStore } from '../../types/services.js';
import type { Competition, PaymentRecord, AgentStatus } from '../../types/index.js';
import { config } from '../../config.js';

export class RealStateStore implements IStateStore {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private competitions: Collection<Competition> | null = null;
  private payments: Collection<PaymentRecord> | null = null;
  private connected = false;

  constructor(private uri?: string) {
    this.uri = uri || config.mongodb.uri;
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    if (!this.uri) {
      throw new Error('MongoDB URI not configured. Set MONGODB_URI environment variable.');
    }

    console.log('[MongoDB] Connecting to database...');

    this.client = new MongoClient(this.uri);
    await this.client.connect();

    this.db = this.client.db('codebounty');
    this.competitions = this.db.collection<Competition>('competitions');
    this.payments = this.db.collection<PaymentRecord>('payments');

    // Create indexes
    await this.createIndexes();

    this.connected = true;
    console.log('[MongoDB] Connected successfully');
  }

  /**
   * Create database indexes for efficient queries
   */
  private async createIndexes(): Promise<void> {
    if (!this.competitions || !this.payments) return;

    // Competition indexes
    await this.competitions.createIndex({ id: 1 }, { unique: true });
    await this.competitions.createIndex({ status: 1 });
    await this.competitions.createIndex({ createdAt: -1 });
    await this.competitions.createIndex({ winner: 1 });

    // Payment indexes
    await this.payments.createIndex({ id: 1 }, { unique: true });
    await this.payments.createIndex({ competitionId: 1 });
    await this.payments.createIndex({ agentId: 1 });
    await this.payments.createIndex({ txHash: 1 }, { unique: true, sparse: true });
    await this.payments.createIndex({ status: 1 });
    await this.payments.createIndex({ createdAt: -1 });

    console.log('[MongoDB] Indexes created');
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      console.log('[MongoDB] Disconnected');
    }
  }

  // ==================== Competition Methods ====================

  async saveCompetition(competition: Competition): Promise<void> {
    await this.ensureConnected();
    if (!this.competitions) throw new Error('Not connected');

    await this.competitions.insertOne(competition);
    console.log(`[MongoDB] Competition saved: ${competition.id}`);
  }

  async getCompetition(id: string): Promise<Competition | null> {
    await this.ensureConnected();
    if (!this.competitions) throw new Error('Not connected');

    return this.competitions.findOne({ id });
  }

  async updateCompetition(id: string, updates: Partial<Competition>): Promise<void> {
    await this.ensureConnected();
    if (!this.competitions) throw new Error('Not connected');

    await this.competitions.updateOne({ id }, { $set: updates });
    console.log(`[MongoDB] Competition updated: ${id}`);
  }

  async updateAgentStatus(
    competitionId: string,
    agentStatus: AgentStatus
  ): Promise<void> {
    await this.ensureConnected();
    if (!this.competitions) throw new Error('Not connected');

    console.log(`[MongoDB] Updating agent ${agentStatus.id} in competition: ${competitionId}`);

    // Atomic update of a single agent in the agents array
    const result = await this.competitions.updateOne(
      { id: competitionId, 'agents.id': agentStatus.id },
      { $set: { 'agents.$': agentStatus } }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Competition or agent not found: ${competitionId}/${agentStatus.id}`);
    }
  }

  async listCompetitions(): Promise<Competition[]> {
    await this.ensureConnected();
    if (!this.competitions) throw new Error('Not connected');

    return this.competitions.find().sort({ createdAt: -1 }).toArray();
  }

  /**
   * Get competitions by status
   */
  async getCompetitionsByStatus(
    status: Competition['status']
  ): Promise<Competition[]> {
    await this.ensureConnected();
    if (!this.competitions) throw new Error('Not connected');

    return this.competitions
      .find({ status })
      .sort({ createdAt: -1 })
      .toArray();
  }

  // ==================== Payment Methods ====================

  /**
   * Save a payment record
   */
  async savePaymentRecord(record: PaymentRecord): Promise<void> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    await this.payments.insertOne(record);
    console.log(`[MongoDB] Payment record saved: ${record.id}`);
  }

  /**
   * Update a payment record by ID
   */
  async updatePaymentRecord(
    id: string,
    updates: Partial<PaymentRecord>
  ): Promise<void> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    await this.payments.updateOne({ id }, { $set: updates });
    console.log(`[MongoDB] Payment record updated: ${id}`);
  }

  /**
   * Update a payment record by transaction hash
   */
  async updatePaymentByTxHash(
    txHash: string,
    updates: Partial<PaymentRecord>
  ): Promise<void> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    await this.payments.updateOne({ txHash }, { $set: updates });
  }

  /**
   * Get payment record by ID
   */
  async getPaymentRecord(id: string): Promise<PaymentRecord | null> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    return this.payments.findOne({ id });
  }

  /**
   * Get payment by transaction hash
   */
  async getPaymentByTxHash(txHash: string): Promise<PaymentRecord | null> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    return this.payments.findOne({ txHash });
  }

  /**
   * Get all payments for an agent
   */
  async getPaymentsByAgent(agentId: string): Promise<PaymentRecord[]> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    return this.payments
      .find({ agentId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Get all payments for a competition
   */
  async getPaymentsByCompetition(competitionId: string): Promise<PaymentRecord[]> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    return this.payments.find({ competitionId }).toArray();
  }

  /**
   * Get total amount paid to an agent
   */
  async getTotalPaidToAgent(agentId: string): Promise<number> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    const result = await this.payments
      .aggregate([
        { $match: { agentId, status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .toArray();

    return result[0]?.total || 0;
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    totalPayments: number;
    totalAmount: number;
    confirmedPayments: number;
    failedPayments: number;
    pendingPayments: number;
  }> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    const stats = await this.payments
      .aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    const result = {
      totalPayments: 0,
      totalAmount: 0,
      confirmedPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
    };

    for (const stat of stats) {
      result.totalPayments += stat.count;
      result.totalAmount += stat.amount;

      if (stat._id === 'confirmed') {
        result.confirmedPayments = stat.count;
      } else if (stat._id === 'failed') {
        result.failedPayments = stat.count;
      } else if (stat._id === 'pending') {
        result.pendingPayments = stat.count;
      }
    }

    return result;
  }

  /**
   * Get recent payments
   */
  async getRecentPayments(limit = 10): Promise<PaymentRecord[]> {
    await this.ensureConnected();
    if (!this.payments) throw new Error('Not connected');

    return this.payments
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}

// Also export as MongoStateStore for those who prefer that name
export { RealStateStore as MongoStateStore };
