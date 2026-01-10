import type { Issue, Solution, Competition, SolveTask, PaymentRequest, PaymentRecord, ReviewResult, AgentStatus } from './index.js';

// GitHub operations
export interface IGitHubService {
  isAuthenticated(): Promise<boolean>;
  getCurrentRepo(): Promise<string | null>;  // Detect from git remote
  getRecentRepos(): Promise<string[]>;       // Local history
  addRecentRepo(repoUrl: string): Promise<void>;
  listIssues(repoUrl: string, limit?: number): Promise<Issue[]>;
  getIssue(repoUrl: string, issueNumber: number): Promise<Issue>;
  createIssue(repoUrl: string, title: string, body: string, labels?: string[]): Promise<Issue>;
  createBranch(repo: string, branchName: string): Promise<void>;
  createPR(repo: string, branch: string, title: string, body: string): Promise<string>;
  createSolutionPR(issue: Issue, solution: Solution, agentName: string): Promise<string>;
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
  updateAgentStatus(competitionId: string, agentStatus: AgentStatus): Promise<void>;
  listCompetitions(): Promise<Competition[]>;
  // Payment records
  savePaymentRecord(record: PaymentRecord): Promise<void>;
  getPaymentRecord(id: string): Promise<PaymentRecord | null>;
}

// Payment handling
export interface IPaymentService {
  requestPayment(agentId: string, amount: number): Promise<PaymentRequest>;
  verifyPayment(signature: string): Promise<boolean>;
  sendBonus(walletAddress: string, amount: number): Promise<string>;
  // Optional extended methods (implemented in RealPaymentService)
  getBalance?(): Promise<number>;
  getWalletAddress?(): Promise<string>;
  healthCheck?(): Promise<{
    healthy: boolean;
    address: string;
    balance: number;
    network: string;
    error?: string;
  }>;
}

// Agent communication
export interface IAgentClient {
  callAgent(agentUrl: string, task: SolveTask): Promise<Solution>;
}

// Code review service
export interface IReviewerService {
  reviewSolutions(issue: Issue, solutions: Solution[]): Promise<ReviewResult>;
}

// All services bundled
export interface Services {
  github: IGitHubService;
  llm: ILLMService;
  state: IStateStore;
  payment: IPaymentService;
  agentClient: IAgentClient;
  reviewer: IReviewerService;
}
