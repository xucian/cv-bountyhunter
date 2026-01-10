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
