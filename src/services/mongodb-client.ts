/**
 * Shared MongoDB client singleton
 * Both State and RAG services should use this instead of creating separate clients
 */
import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';

class SharedMongoClient {
  private static client: MongoClient | null = null;
  private static db: Db | null = null;
  private static connecting: Promise<void> | null = null;

  static async getClient(): Promise<{ client: MongoClient; db: Db }> {
    // If already connected, return immediately
    if (this.client && this.db) {
      return { client: this.client, db: this.db };
    }

    // If currently connecting, wait for it
    if (this.connecting) {
      await this.connecting;
      return { client: this.client!, db: this.db! };
    }

    // Start new connection
    this.connecting = this.connect();
    await this.connecting;
    this.connecting = null;

    return { client: this.client!, db: this.db! };
  }

  private static async connect(): Promise<void> {
    console.log('[MongoDB] Connecting to Atlas (shared client)...');

    this.client = new MongoClient(config.mongodb.uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10, // Allow multiple operations
    });

    await this.client.connect();
    this.db = this.client.db(config.mongodb.dbName);

    console.log('[MongoDB] ✓ Connected (shared client)');
  }

  static async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}

export { SharedMongoClient };
