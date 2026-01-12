/**
 * MongoDB connection for the web app.
 * Connects to the same database as the TUI/CLI.
 */

import { MongoClient, Db, Collection } from 'mongodb';
import type { Competition, PaymentRecord } from './services';

// Connection string from environment
const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.warn('[DB] MONGODB_URI not set - database operations will fail');
}

// Global cached connection
let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Get MongoDB database connection (cached)
 */
export async function getDatabase(): Promise<Db> {
  if (db) return db;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db('codebounty');

  console.log('[DB] Connected to MongoDB');
  return db;
}

/**
 * Get competitions collection
 */
export async function getCompetitionsCollection(): Promise<Collection<Competition>> {
  const database = await getDatabase();
  return database.collection<Competition>('competitions');
}

/**
 * Get payment records collection
 */
export async function getPaymentsCollection(): Promise<Collection<PaymentRecord>> {
  const database = await getDatabase();
  return database.collection<PaymentRecord>('payments');
}

/**
 * List all competitions (most recent first)
 */
export async function listCompetitions(limit = 50): Promise<Competition[]> {
  const collection = await getCompetitionsCollection();
  return collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Get a single competition by ID
 */
export async function getCompetition(id: string): Promise<Competition | null> {
  const collection = await getCompetitionsCollection();
  return collection.findOne({ id });
}

/**
 * Save a new competition
 */
export async function saveCompetition(competition: Competition): Promise<void> {
  const collection = await getCompetitionsCollection();
  await collection.insertOne(competition);
}

/**
 * Update a competition
 */
export async function updateCompetition(
  id: string,
  updates: Partial<Competition>
): Promise<void> {
  const collection = await getCompetitionsCollection();
  await collection.updateOne({ id }, { $set: updates });
}

/**
 * Get all payments for an agent (sorted by newest first)
 */
export async function getPaymentsByAgent(agentId: string): Promise<PaymentRecord[]> {
  const collection = await getPaymentsCollection();
  return collection
    .find({ agentId })
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * Get agent stats from payments collection
 */
export async function getAgentPaymentStats(agentId: string): Promise<{
  totalEarnings: number;
  confirmedPayments: number;
  pendingPayments: number;
}> {
  const collection = await getPaymentsCollection();
  const payments = await collection.find({ agentId }).toArray();
  
  return {
    totalEarnings: payments
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + p.amount, 0),
    confirmedPayments: payments.filter(p => p.status === 'confirmed').length,
    pendingPayments: payments.filter(p => p.status === 'pending').length,
  };
}

