import { MongoClient, Db, Collection } from 'mongodb';
import type { IStateStore } from '../../types/services.js';
import type { Competition } from '../../types/index.js';
import { config } from '../../config.js';

export class RealStateStore implements IStateStore {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private competitions: Collection<Competition> | null = null;

  private async ensureConnected(): Promise<void> {
    if (this.client && this.db) return;

    if (!config.mongodb.uri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    console.log('[MongoState] Connecting to MongoDB...');
    this.client = new MongoClient(config.mongodb.uri);
    await this.client.connect();

    this.db = this.client.db('codebounty');
    this.competitions = this.db.collection<Competition>('competitions');

    // Create index on id field
    await this.competitions.createIndex({ id: 1 }, { unique: true });

    console.log('[MongoState] Connected to MongoDB');
  }

  async saveCompetition(competition: Competition): Promise<void> {
    await this.ensureConnected();

    console.log(`[MongoState] Saving competition: ${competition.id}`);
    await this.competitions!.insertOne(competition);
  }

  async getCompetition(id: string): Promise<Competition | null> {
    await this.ensureConnected();

    console.log(`[MongoState] Getting competition: ${id}`);
    const competition = await this.competitions!.findOne({ id });
    return competition;
  }

  async updateCompetition(
    id: string,
    updates: Partial<Competition>
  ): Promise<void> {
    await this.ensureConnected();

    console.log(`[MongoState] Updating competition: ${id}`);
    const result = await this.competitions!.updateOne(
      { id },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Competition not found: ${id}`);
    }
  }

  async listCompetitions(): Promise<Competition[]> {
    await this.ensureConnected();

    console.log(`[MongoState] Listing all competitions`);
    return this.competitions!.find().sort({ createdAt: -1 }).toArray();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.competitions = null;
      console.log('[MongoState] Disconnected from MongoDB');
    }
  }
}
