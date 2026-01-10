import type { Issue, Solution, Competition, SolveTask, PaymentRequest } from './index.js';

// GitHub operations
export interface IGitHubService {
  isAuthenticated(): Promise<boolean>;
  getIssue(repoUrl: string, issueNumber: number): Promise<Issue>;
  createBranch(repo: string, branchName: string): Promise<void>;
  createPR(repo: string, branch: string, title: string, body: string): Promise<string>;
}

// AI/LLM for code generation
export interface ILLMService {
  generateSolution(prompt: string, model: string): Promise<string>;
}

// State persistence
export interface IStateStore {
  saveCompetition(competition: Competition): Promise<void>;
  getCompetition(id: string): Promise<Competition | null>;
  updateCompetition(id: string, updates: Partial<Competition>): Promise<void>;
  listCompetitions(): Promise<Competition[]>;
}

// Payment handling
export interface IPaymentService {
  requestPayment(agentId: string, amount: number): Promise<PaymentRequest>;
  verifyPayment(signature: string): Promise<boolean>;
  sendBonus(walletAddress: string, amount: number): Promise<string>;
}

// Agent communication
export interface IAgentClient {
  callAgent(agentUrl: string, task: SolveTask): Promise<Solution>;
}

// All services bundled
export interface Services {
  github: IGitHubService;
  llm: ILLMService;
  state: IStateStore;
  payment: IPaymentService;
  agentClient: IAgentClient;
}
