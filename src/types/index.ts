// Domain Types

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

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  port: number;
  walletAddress?: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'solving' | 'done' | 'failed';
  solution?: Solution;
  startedAt?: number;
  completedAt?: number;
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

export interface SolveTask {
  agentId: string;
  issue: Issue;
  codeContext?: string;
}

export interface PaymentRequest {
  paymentId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  recipient?: string;
  timestamp?: number;
  network?: string;
}

/**
 * Payment record for tracking completed payments
 */
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
  blockNumber?: number;
  error?: string;
}

/**
 * Wallet information
 */
export interface WalletInfo {
  address: string;
  balance: number;
  network: string;
}

export interface ReviewScore {
  agentId: string;
  score: number;        // 0-100
  correctness: number;  // 0-100
  codeQuality: number;  // 0-100
  completeness: number; // 0-100
  reasoning: string;
}

export interface ReviewResult {
  winnerId: string | null;
  scores: ReviewScore[];
  summary: string;
  reviewTimeMs: number;
}
