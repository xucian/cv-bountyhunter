import { config } from '../config.js';
import type { Services } from '../types/services.js';

// Mock implementations
import { MockGitHubService } from './github/mock.js';
import { MockLLMService } from './llm/mock.js';
import { MockStateStore } from './state/mock.js';
import { MockPaymentService } from './payment/mock.js';
import { MockAgentClient } from './agent-client/mock.js';
import { MockReviewerService } from './reviewer/mock.js';
import { MockRAGService } from './rag/mock.js';

// Real implementations
import { RealGitHubService } from './github/real.js';
import { RealLLMService } from './llm/real.js';
import { RealStateStore } from './state/real.js';
import { RealPaymentService } from './payment/real.js';
import { RealAgentClient } from './agent-client/real.js';
import { RealReviewerService } from './reviewer/real.js';
import { RealRAGService } from './rag/real.js';

/**
 * Creates and returns all services based on config.useMocks flags.
 *
 * Each service can be independently mocked or use real implementation:
 * - Set MOCK_GITHUB=false to use real GitHub service
 * - Set MOCK_LLM=false to use real LLM service
 * - Set MOCK_STATE=false to use real state store (MongoDB)
 * - Set MOCK_PAYMENT=false to use real payment service (X402)
 * - Set MOCK_AGENTS=false to use real agent client
 * - Set MOCK_REVIEWER=false to use real reviewer service
 *
 * By default, all services are mocked for development.
 */
export function createServices(): Services {
  const { useMocks } = config;

  const github = useMocks.github
    ? new MockGitHubService()
    : new RealGitHubService();

  const llm = useMocks.llm
    ? new MockLLMService()
    : new RealLLMService();

  const state = useMocks.state
    ? new MockStateStore()
    : new RealStateStore();

  const payment = useMocks.payment
    ? new MockPaymentService()
    : new RealPaymentService();

  const agentClient = useMocks.agents
    ? new MockAgentClient()
    : new RealAgentClient();

  const reviewer = useMocks.reviewer
    ? new MockReviewerService()
    : new RealReviewerService();

  const rag = useMocks.rag
    ? new MockRAGService()
    : new RealRAGService();

  console.log('[Services] Initialized with:');
  console.log(`  - GitHub: ${useMocks.github ? 'MOCK' : 'REAL'}`);
  console.log(`  - LLM: ${useMocks.llm ? 'MOCK' : 'REAL'}`);
  console.log(`  - State: ${useMocks.state ? 'MOCK' : 'REAL'}`);
  console.log(`  - Payment: ${useMocks.payment ? 'MOCK' : 'REAL'}`);
  console.log(`  - Agents: ${useMocks.agents ? 'MOCK' : 'REAL'}`);
  console.log(`  - Reviewer: ${useMocks.reviewer ? 'MOCK' : 'REAL'}`);
  console.log(`  - RAG: ${useMocks.rag ? 'MOCK' : 'REAL'}`);

  return {
    github,
    llm,
    state,
    payment,
    agentClient,
    reviewer,
    rag,
  };
}

// Re-export types for convenience
export type { Services } from '../types/services.js';

// Re-export individual mock classes for testing
export { MockGitHubService } from './github/mock.js';
export { MockLLMService } from './llm/mock.js';
export { MockStateStore } from './state/mock.js';
export { MockPaymentService } from './payment/mock.js';
export { MockAgentClient } from './agent-client/mock.js';
export { MockReviewerService } from './reviewer/mock.js';
export { MockRAGService } from './rag/mock.js';
