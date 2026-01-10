
# CodeBounty: Final Implementation Plan

## 1. Overview

This document provides the complete, final implementation plan for CodeBounty. It consolidates all design decisions into a single, actionable guide for building the project in **2 hours**.

**Core Concept**: A competitive marketplace where AI agents, powered by different Fireworks AI models, race to fix GitHub issues and earn USDC bounties via the X402 protocol. The entire experience is managed through a beautiful terminal UI built with React Ink.

### Final Architecture

- **Stack**: TypeScript/Node.js
- **TUI**: React Ink
- **Agents**: 1 coding agent codebase, 3 instances with different models (Llama, Qwen, DeepSeek)
- **GitHub**: `gh` CLI for seamless authentication and operations
- **Discovery**: Local agent registry (hardcoded URLs for development)
- **Payments**: X402 for agent-to-orchestrator payments, direct wallet transfers for bonuses
- **Database**: MongoDB Atlas for vector search (code context) and as the system of record for all competition data.

```
┌─────────────────────────────────────────────────────────────┐
│                    React Ink TUI (gh auth)                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Orchestrator (TypeScript)                   │
│  - Discovers agents via local registry                       │
│  - Calls agents (triggers X402 payment)                      │
│  - Stores all state in MongoDB                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Agent 1 │ │Agent 2 │ │Agent 3 │
    │(Llama) │ │(Qwen)  │ │(DeepSeek)│
    │ Express│ │ Express│ │ Express│
    │ Server │ │ Server │ │ Server │
    └────────┘ └────────┘ └────────┘
```

## 2. Project Setup

### Directory Structure

```
codebounty/
├── src/
│   ├── agents/              # Agent logic & server
│   │   ├── coding-agent.ts
│   │   ├── reviewer-agent.ts
│   │   └── agent-server.ts
│   ├── orchestrator/        # Main coordination logic
│   │   └── orchestrator.ts
│   ├── tui/                 # React Ink components
│   │   └── ...
│   ├── services/            # External service integrations
│   │   ├── mongodb.ts
│   │   ├── github.ts
│   │   └── ...
│   ├── indexer/             # Codebase indexing
│   │   └── indexer.ts
│   ├── types/               # Shared type definitions
│   │   └── index.ts
│   └── launch-agents.ts     # Script to start all agent servers
├── .env
├── package.json
└── tsconfig.json
```

### `package.json`

```json
{
  "name": "codebounty",
  "version": "1.0.0",
  "scripts": {
    "dev:tui": "tsx src/tui/index.tsx",
    "dev:agents": "tsx src/launch-agents.ts",
    "build": "tsc",
    "start:agents": "node dist/launch-agents.js",
    "start:tui": "node dist/tui/index.js"
  },
  "dependencies": {
    "ink": "^4.4.1",
    "ink-spinner": "^5.0.0",
    "ink-text-input": "^5.0.1",
    "react": "^18.2.0",
    "mongodb": "^6.3.0",
    "@x402/client": "^1.0.0",
    "@x402/evm-exact": "^1.0.0",
    "viem": "^2.0.0",
    "express": "^4.18.2",
    "voyageai": "^1.0.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.21",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0"
  }
}
```

### `.env` File

```
# MongoDB
MONGODB_URI="your_mongodb_atlas_uri"

# Fireworks AI
FIREWORKS_API_KEY="your_fireworks_api_key"

# Voyage AI
VOYAGE_API_KEY="your_voyage_api_key"

# Orchestrator Wallet (for X402 payments)
ORCHESTRATOR_PRIVATE_KEY="0x..."

# Agent Wallets (to receive payments)
AGENT_LLAMA_WALLET_ADDRESS="0x..."
AGENT_QWEN_WALLET_ADDRESS="0x..."
AGENT_DEEPSEEK_WALLET_ADDRESS="0x..."
```

## 3. Core Implementation

### GitHub Service (`gh` CLI)

**File**: `src/services/github.ts`

- Uses `execAsync` to run `gh` commands.
- `isAuthenticated()` checks `gh auth status`.
- `getIssue()` uses `gh issue view --json`.
- `createPR()` uses `gh pr create`.
- **Benefit**: No token management. Relies on user's existing `gh` authentication.

### Agent Server (Local Development)

**File**: `src/agents/agent-server.ts`

1. Each agent is an `express` server.
2. The `/solve` endpoint is X402-enabled:
   - If no `payment-signature` header, returns `402 Payment Required` with payment details.
   - If payment signature is present, it processes the request.
3. For local development, agents are registered in a hardcoded local registry.

### Launching Agents

**File**: `src/launch-agents.ts`

- A simple script that imports and starts the 3 agent servers on different ports (3001, 3002, 3003).
- This allows all agents to run in a single process for easy development.

### Orchestrator (Local Discovery)

**File**: `src/orchestrator/orchestrator.ts`

- **Discovery**: Uses a local list of agent URLs for development (localhost:3001, 3002, 3003).
- **Execution**: Calls each agent's `/solve` endpoint. The `wrapFetchWithPayment` from the X402 client SDK automatically handles the 402 payment flow.
- **State Management**: All competition progress (discovery, agent status, review, payments) is logged to MongoDB.

### React Ink TUI

**File**: `src/tui/`

- **Real-time Updates**: The `CompetitionView` component uses a custom `useCompetition` hook that polls the MongoDB `competitions` collection every 250ms.
- **Component-based**: The UI is broken down into reusable components like `AgentCard`, `ProgressBar`, and `ResultsView`.
- **Claude-like UX**: Clean, minimalist design with spinners, colors, and borders to provide a polished, professional feel.

## 4. 2-Hour Development Plan

| Time | Focus | Key Tasks |
|---|---|---|
| **0:00-0:20** | **Foundation** | Project setup, install deps, MongoDB connection, basic types |
| **0:20-0:40** | **Agents** | Agent server (Express), `/solve` endpoint with X402, launch script |
| **0:40-1:00** | **Agent Logic** | Implement `CodingAgent` with Fireworks AI (3 model configs) |
| **1:00-1:20** | **Orchestrator** | Local discovery, competition workflow, payment logic |
| **1:20-1:40** | **TUI** | Build Main Menu, live `CompetitionView`, basic styling |
| **1:40-2:00** | **Polish** | End-to-end testing, bug fixes, demo prep |

## 5. Why This Plan Will Succeed

- **Simplicity**: The "one agent, three models" approach with local discovery is achievable in 2 hours.
- **Completeness**: It demonstrates the X402 payment protocol, satisfying the hackathon track requirements.
- **Impressive UX**: The React Ink TUI provides a polished, visually compelling demo that stands out.
- **Robustness**: Using the `gh` CLI and a structured TypeScript codebase with error handling makes the project more stable.
- **Clear Path**: The time-boxed plan provides a clear, actionable path from setup to demo.

This plan is focused, technically sound, and designed to produce a working hackathon demo in 2 hours.
