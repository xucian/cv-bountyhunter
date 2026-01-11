import type { Issue, Solution, Competition, SolveTask, PaymentRequest, PaymentRecord, ReviewResult, AgentStatus, TaskEvaluation } from './index.js';
import type { CompetitionEvent } from './events.js';

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

// Streaming callback type
export type StreamCallback = (chunk: string, accumulated: string) => void;

// AI/LLM for code generation
export interface ILLMService {
  generateSolution(prompt: string, model: string): Promise<string>;
  generateSolutionStreaming?(
    prompt: string,
    model: string,
    onChunk: StreamCallback
  ): Promise<string>;
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
  evaluateAgent(agentUrl: string, issue: Issue, bountyAmount: number): Promise<TaskEvaluation & { agentId: string }>;
  callAgent(agentUrl: string, task: SolveTask): Promise<Solution>;
}

// Code review service
export interface IReviewerService {
  reviewSolutions(issue: Issue, solutions: Solution[]): Promise<ReviewResult>;
  reviewSolutionsStreaming?(
    issue: Issue,
    solutions: Solution[],
    onChunk: StreamCallback
  ): Promise<ReviewResult>;
}

// RAG (Retrieval-Augmented Generation) service for code indexing and search
export interface IRAGService {
  /**
   * Index a local repository into MongoDB Atlas
   * @param repoPath - Local filesystem path to repo (e.g., "/Users/me/project")
   * @param repoUrl - GitHub URL (e.g., "https://github.com/owner/repo")
   * @returns Commit ID and number of chunks indexed
   */
  indexRepo(repoPath: string, repoUrl: string): Promise<{
    commitId: string;
    chunksIndexed: number;
  }>;

  /**
   * Query relevant code chunks for an issue
   * @param issue - The GitHub issue to find relevant code for
   * @param limit - Max number of chunks to return (default: 10)
   * @returns Array of relevant code chunks, sorted by relevance score
   */
  queryRelevantCode(issue: Issue, limit?: number): Promise<CodeChunk[]>;

  /**
   * Check if a repo is already indexed
   * @param repoUrl - GitHub URL
   * @param commitId - Git commit SHA
   * @returns True if already indexed
   */
  isRepoIndexed(repoUrl: string, commitId: string): Promise<boolean>;
}

// Code chunk representation for RAG
export interface CodeChunk {
  filePath: string;
  chunkType: 'function' | 'class' | 'method';
  chunkName: string;
  code: string;
  score?: number; // Relevance score from vector search
}

// Event emitter for real-time updates
export interface IEventEmitter {
  /**
   * Emit an event to all subscribers
   */
  emit(event: CompetitionEvent): Promise<void>;

  /**
   * Subscribe to events
   * Returns unsubscribe function
   */
  subscribe(handler: (event: CompetitionEvent) => void): () => void;
}

// All services bundled
export interface Services {
  github: IGitHubService;
  llm: ILLMService;
  state: IStateStore;
  payment: IPaymentService;
  agentClient: IAgentClient;
  reviewer: IReviewerService;
  rag: IRAGService;
  events: IEventEmitter;
}
