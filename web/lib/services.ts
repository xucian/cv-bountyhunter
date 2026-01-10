/**
 * Services singleton for the web app.
 * Imports and uses the shared services from the parent src directory.
 *
 * Note: In Next.js API routes, this creates services per-request.
 * The MockEventEmitter uses a singleton pattern so events are shared.
 */

// We can't directly import from ../src in Next.js easily,
// so we'll re-implement the service creation here for the web app.
// The services use the same MongoDB and configuration.

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load env from parent directory
dotenvConfig({ path: resolve(process.cwd(), '..', '.env') });

// For now, we'll create a simplified services object that works with the API routes
// The actual service implementations will be imported or duplicated as needed

export interface Issue {
  number: number;
  title: string;
  body: string;
  repoUrl: string;
  labels: string[];
}

export interface Solution {
  agentId: string;
  code: string;
  timeMs: number;
  success: boolean;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'solving' | 'done' | 'failed';
  solution?: Solution;
  startedAt?: number;
  completedAt?: number;
}

export interface ReviewScore {
  agentId: string;
  score: number;
  correctness: number;
  codeQuality: number;
  completeness: number;
  reasoning: string;
}

export interface ReviewResult {
  winnerId: string | null;
  scores: ReviewScore[];
  summary: string;
  reviewTimeMs: number;
}

export interface PaymentRecord {
  id: string;
  competitionId: string;
  agentId: string;
  walletAddress: string;
  amount: number;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  network: string;
  createdAt: number;
  confirmedAt?: number;
  error?: string;
}

export interface Competition {
  id: string;
  issue: Issue;
  bountyAmount: number;
  status: 'pending' | 'running' | 'judging' | 'paying' | 'completed';
  agents: AgentStatus[];
  winner?: string;
  reviewResult?: ReviewResult;
  paymentTxHash?: string;
  paymentError?: string;
  paymentRecord?: PaymentRecord;
  createdAt: number;
  completedAt?: number;
}

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  port: number;
  walletAddress?: string;
}

// Agent configurations (same as parent config)
export const agents: AgentConfig[] = [
  {
    id: 'llama',
    name: 'Llama Agent',
    model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    port: 3001,
    walletAddress: process.env.AGENT_LLAMA_WALLET,
  },
  {
    id: 'qwen',
    name: 'Qwen Agent',
    model: 'accounts/fireworks/models/qwen3-coder-30b-a3b-instruct',
    port: 3002,
    walletAddress: process.env.AGENT_QWEN_WALLET,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Agent',
    model: 'accounts/fireworks/models/deepseek-v3p2',
    port: 3003,
    walletAddress: process.env.AGENT_DEEPSEEK_WALLET,
  },
];

// WebSocket URL
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
