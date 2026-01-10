
# CodeBounty: Final Implementation Plan

## 1. Overview

This document provides the complete, final implementation plan for CodeBounty. It consolidates all design decisions into a single, actionable guide for building the project in **2 hours**.

**Core Concept**: A competitive marketplace where AI agents, powered by different Fireworks AI models, race to fix GitHub issues and earn USDC bounties via the X402 protocol. The entire experience is managed through a beautiful terminal UI built with React Ink.

**Build Philosophy**: Every external service is abstracted behind an interface with both Mock and Real implementations. This allows:
- One-shot build with all mocks working end-to-end
- Independent integration of real services without touching other code
- Easy testing and demo reliability

### Final Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Ink TUI                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Orchestrator                                │
│  - Uses injected services (mock or real)                     │
│  - Coordinates competition flow                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Agent 1 │ │Agent 2 │ │Agent 3 │
    │(Llama) │ │(Qwen)  │ │(DeepSeek)│
    └────────┘ └────────┘ └────────┘
```

## 2. Service Abstraction Layer

Every external dependency is behind an interface. Toggle implementations via `src/config.ts`.

### Service Interfaces

```typescript
// src/types/services.ts

// GitHub operations
interface IGitHubService {
  isAuthenticated(): Promise<boolean>;
  getIssue(repoUrl: string, issueNumber: number): Promise<Issue>;
  createBranch(repo: string, branchName: string): Promise<void>;
  createPR(repo: string, branch: string, title: string, body: string): Promise<string>;
}

// AI/LLM for code generation
interface ILLMService {
  generateSolution(prompt: string, model: string): Promise<string>;
}

// State persistence
interface IStateStore {
  saveCompetition(competition: Competition): Promise<void>;
  getCompetition(id: string): Promise<Competition | null>;
  updateCompetition(id: string, updates: Partial<Competition>): Promise<void>;
  listCompetitions(): Promise<Competition[]>;
}

// Payment handling
interface IPaymentService {
  requestPayment(agentId: string, amount: number): Promise<PaymentRequest>;
  verifyPayment(signature: string): Promise<boolean>;
  sendBonus(walletAddress: string, amount: number): Promise<string>;
}

// Agent communication
interface IAgentClient {
  callAgent(agentUrl: string, task: SolveTask): Promise<Solution>;
}
```

### Implementation Toggle

```typescript
// src/config.ts
export const config = {
  useMocks: {
    github: process.env.MOCK_GITHUB !== 'false',      // default: true
    llm: process.env.MOCK_LLM !== 'false',            // default: true
    state: process.env.MOCK_STATE !== 'false',        // default: true
    payment: process.env.MOCK_PAYMENT !== 'false',    // default: true
    agents: process.env.MOCK_AGENTS !== 'false',      // default: true
  },

  agents: [
    { id: 'llama', name: 'Llama Agent', model: 'accounts/fireworks/models/llama-v3p1-70b-instruct', port: 3001 },
    { id: 'qwen', name: 'Qwen Agent', model: 'accounts/fireworks/models/qwen2p5-coder-32b-instruct', port: 3002 },
    { id: 'deepseek', name: 'DeepSeek Agent', model: 'accounts/fireworks/models/deepseek-v3', port: 3003 },
  ],
};
```

### Service Factory

```typescript
// src/services/index.ts
import { config } from '../config';

// GitHub
import { MockGitHubService } from './github/mock';
import { RealGitHubService } from './github/real';

// LLM
import { MockLLMService } from './llm/mock';
import { RealLLMService } from './llm/real';

// State
import { MockStateStore } from './state/mock';
import { MongoStateStore } from './state/real';

// Payment
import { MockPaymentService } from './payment/mock';
import { RealPaymentService } from './payment/real';

// Agent Client
import { MockAgentClient } from './agent-client/mock';
import { RealAgentClient } from './agent-client/real';

export function createServices() {
  return {
    github: config.useMocks.github ? new MockGitHubService() : new RealGitHubService(),
    llm: config.useMocks.llm ? new MockLLMService() : new RealLLMService(),
    state: config.useMocks.state ? new MockStateStore() : new MongoStateStore(),
    payment: config.useMocks.payment ? new MockPaymentService() : new RealPaymentService(),
    agentClient: config.useMocks.agents ? new MockAgentClient() : new RealAgentClient(),
  };
}

export type Services = ReturnType<typeof createServices>;
```

## 3. Project Structure

```
codebounty/
├── src/
│   ├── types/
│   │   ├── index.ts              # Domain types (Competition, Issue, Solution, etc.)
│   │   └── services.ts           # Service interfaces
│   │
│   ├── config.ts                 # Feature flags and agent config
│   │
│   ├── services/
│   │   ├── index.ts              # Service factory
│   │   ├── github/
│   │   │   ├── mock.ts           # Returns fake issue data
│   │   │   └── real.ts           # Uses `gh` CLI
│   │   ├── llm/
│   │   │   ├── mock.ts           # Returns fake code after delay
│   │   │   └── real.ts           # Calls Fireworks AI
│   │   ├── state/
│   │   │   ├── mock.ts           # In-memory Map
│   │   │   └── real.ts           # MongoDB
│   │   ├── payment/
│   │   │   ├── mock.ts           # Logs payments, always succeeds
│   │   │   └── real.ts           # X402 protocol
│   │   └── agent-client/
│   │       ├── mock.ts           # Direct function call with fake delay
│   │       └── real.ts           # HTTP calls to agent servers
│   │
│   ├── agents/
│   │   ├── agent-server.ts       # Express server for each agent
│   │   ├── coding-agent.ts       # Core agent logic (uses ILLMService)
│   │   └── x402-middleware.ts    # Payment gate middleware
│   │
│   ├── orchestrator/
│   │   └── orchestrator.ts       # Competition coordinator
│   │
│   ├── tui/
│   │   ├── index.tsx             # Entry point
│   │   ├── App.tsx               # Main app with navigation
│   │   ├── components/
│   │   │   ├── MainMenu.tsx
│   │   │   ├── CompetitionView.tsx
│   │   │   ├── AgentCard.tsx
│   │   │   └── ResultsView.tsx
│   │   └── hooks/
│   │       └── useCompetition.ts
│   │
│   └── launch-agents.ts          # Starts all 3 agent servers
│
├── .env.example
├── package.json
└── tsconfig.json
```

## 4. Mock Implementations

### Mock GitHub Service
```typescript
// src/services/github/mock.ts
export class MockGitHubService implements IGitHubService {
  async isAuthenticated() { return true; }

  async getIssue(repoUrl: string, issueNumber: number): Promise<Issue> {
    return {
      number: issueNumber,
      title: 'Fix null pointer exception in user service',
      body: 'When a user has no profile picture, the app crashes...',
      repoUrl,
      labels: ['bug', 'bounty:50'],
    };
  }

  async createBranch() { console.log('[MOCK] Branch created'); }
  async createPR() { return 'https://github.com/example/repo/pull/123'; }
}
```

### Mock LLM Service
```typescript
// src/services/llm/mock.ts
export class MockLLMService implements ILLMService {
  async generateSolution(prompt: string, model: string): Promise<string> {
    // Simulate thinking time (2-5 seconds)
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

    return `
// Fix for null pointer exception
function getUserAvatar(user: User): string {
  return user.profilePicture ?? '/default-avatar.png';
}
    `.trim();
  }
}
```

### Mock State Store
```typescript
// src/services/state/mock.ts
export class MockStateStore implements IStateStore {
  private competitions = new Map<string, Competition>();

  async saveCompetition(c: Competition) { this.competitions.set(c.id, c); }
  async getCompetition(id: string) { return this.competitions.get(id) ?? null; }
  async updateCompetition(id: string, updates: Partial<Competition>) {
    const existing = this.competitions.get(id);
    if (existing) this.competitions.set(id, { ...existing, ...updates });
  }
  async listCompetitions() { return Array.from(this.competitions.values()); }
}
```

### Mock Payment Service
```typescript
// src/services/payment/mock.ts
export class MockPaymentService implements IPaymentService {
  async requestPayment(agentId: string, amount: number) {
    console.log(`[MOCK] Payment requested: ${amount} USDC to ${agentId}`);
    return { paymentId: `pay_${Date.now()}`, amount, status: 'pending' };
  }

  async verifyPayment(signature: string) { return true; }

  async sendBonus(walletAddress: string, amount: number) {
    console.log(`[MOCK] Bonus sent: ${amount} USDC to ${walletAddress}`);
    return `tx_${Date.now()}`;
  }
}
```

### Mock Agent Client
```typescript
// src/services/agent-client/mock.ts
export class MockAgentClient implements IAgentClient {
  async callAgent(agentUrl: string, task: SolveTask): Promise<Solution> {
    // Simulate agent work (3-8 seconds)
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));

    return {
      agentId: task.agentId,
      code: `// Solution from ${task.agentId}\nfunction fix() { return true; }`,
      timeMs: Math.floor(3000 + Math.random() * 5000),
      success: Math.random() > 0.2, // 80% success rate
    };
  }
}
```

## 5. Domain Types

```typescript
// src/types/index.ts
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
```

## 6. Build Order

Build everything in one pass with this order:

1. **Types** (`src/types/`) - All interfaces and domain types
2. **Config** (`src/config.ts`) - Feature flags
3. **Mock Services** (`src/services/*/mock.ts`) - All mock implementations
4. **Service Factory** (`src/services/index.ts`) - Wires up mocks
5. **Orchestrator** (`src/orchestrator/`) - Uses injected services
6. **TUI** (`src/tui/`) - React Ink components
7. **Agent Server** (`src/agents/`) - Express server (uses ILLMService)
8. **Launch Script** (`src/launch-agents.ts`)

After one-shot build with mocks, swap in real implementations one at a time:
- `MOCK_LLM=false` - Real Fireworks AI
- `MOCK_GITHUB=false` - Real `gh` CLI
- `MOCK_PAYMENT=false` - Real X402
- `MOCK_STATE=false` - Real MongoDB
- `MOCK_AGENTS=false` - Real HTTP calls

## 7. Environment Variables

```bash
# .env.example

# Service toggles (all default to mock=true)
MOCK_GITHUB=true
MOCK_LLM=true
MOCK_STATE=true
MOCK_PAYMENT=true
MOCK_AGENTS=true

# Real service credentials (only needed when mocks disabled)
MONGODB_URI=
FIREWORKS_API_KEY=
VOYAGE_API_KEY=
ORCHESTRATOR_PRIVATE_KEY=
AGENT_LLAMA_WALLET=
AGENT_QWEN_WALLET=
AGENT_DEEPSEEK_WALLET=
```

## 8. 2-Hour Build Plan

| Time | Task |
|------|------|
| 0:00-0:15 | Project setup, types, config |
| 0:15-0:35 | All mock services |
| 0:35-0:55 | Orchestrator logic |
| 0:55-1:20 | TUI components |
| 1:20-1:35 | Agent server + launch script |
| 1:35-2:00 | Wire up, test end-to-end with mocks |

## 9. Why This Approach Works

- **Parallel Development**: Multiple devs can work on real implementations independently
- **Demo Reliability**: Mocks guarantee a working demo even if APIs fail
- **Easy Testing**: Each service can be tested in isolation
- **Gradual Integration**: Swap one real service at a time, verify, repeat
- **Clean Architecture**: Dependency injection makes the code maintainable

The entire system works end-to-end with mocks from day one. Real integrations are just configuration changes.
