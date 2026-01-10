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
  status: 'pending' | 'running' | 'judging' | 'completed';
  agents: AgentStatus[];
  winner?: string;
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
