# X402 Real Payment Integration Plan

## Executive Summary

Transform the mock payment system into a fully functional x402-powered USDC payment flow. This plan enables AI agents to receive real bounties via CDP Wallets and x402 protocol on the Base network.

**Target**: Hackathon Track - "Agentic Commerce on MongoDB: CDP Wallets + x402-Driven Tool Chaining"

---

## Implementation Progress Log

### 2025-01-10: Milestone 1 & 2 Complete

**Environment**: Base Sepolia (Testnet) - NO MAINNET

#### Milestone 1: Environment & Dependencies Setup ✅

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Install dependencies | ✅ Done | `@x402/core`, `@x402/evm`, `@x402/express`, `@x402/fetch`, `@coinbase/cdp-sdk`, `viem` |
| 1.2 Update .env.example | ✅ Done | Added X402_NETWORK, USDC_CONTRACT_ADDRESS, CDP credentials |
| 1.3 Update config.ts | ✅ Done | Added `x402` and `cdp` config sections |

**Key Config (Testnet by default):**
```typescript
x402: {
  network: 'base-sepolia',  // TESTNET
  usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',  // Base Sepolia USDC
}
```

#### Milestone 2: CDP Wallet Integration ✅

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Create wallet types | ✅ Done | `src/services/wallet/types.ts` |
| 2.2 Implement Viem wallet | ✅ Done | `src/services/wallet/viem-wallet.ts` - Private key based |
| 2.3 Implement CDP wallet | ✅ Done | `src/services/wallet/cdp-wallet.ts` - Managed keys |
| 2.4 Create wallet factory | ✅ Done | `src/services/wallet/index.ts` - Auto-detects credentials |

**New Files Created:**
```
src/services/wallet/
├── types.ts           # IWalletService interface
├── viem-wallet.ts     # Direct private key implementation
├── cdp-wallet.ts      # CDP managed wallet implementation
└── index.ts           # Factory + exports
```

**TypeScript Compilation**: ✅ Passes with no errors

#### Milestone 3: Real Payment Service ✅

| Task | Status | Notes |
|------|--------|-------|
| 3.1 Implement RealPaymentService | ✅ Done | Full USDC transfer support with balance checking |

**File Updated:** `src/services/payment/real.ts`

#### Milestone 4: X402 Middleware ✅

| Task | Status | Notes |
|------|--------|-------|
| 4.1 Create x402 middleware | ✅ Done | `src/agents/x402-middleware.ts` - 402 Payment Required flow |

#### Milestone 5: Extended Types ✅

| Task | Status | Notes |
|------|--------|-------|
| 5.1 Add PaymentRecord type | ✅ Done | Tracks tx hash, status, block number |
| 5.2 Extend IPaymentService | ✅ Done | Added getBalance, getWalletAddress, healthCheck |
| 5.3 Update Competition type | ✅ Done | Added paymentRecord field |

#### Milestone 6: MongoDB Payment Persistence ✅

| Task | Status | Notes |
|------|--------|-------|
| 6.1 Implement RealStateStore | ✅ Done | Full MongoDB integration with payment tracking |
| 6.2 Payment indexes | ✅ Done | Indexes on txHash, agentId, competitionId |
| 6.3 Payment stats | ✅ Done | Aggregation for total paid, success/failure counts |

**File Updated:** `src/services/state/real.ts`

#### Milestone 7: Orchestrator Integration ✅

| Task | Status | Notes |
|------|--------|-------|
| 7.1 Payment tracking | ✅ Done | Creates PaymentRecord before/after payment |
| 7.2 Balance checking | ✅ Done | Validates balance before sending |
| 7.3 Payment stats method | ✅ Done | `getPaymentStats()` for wallet info |

**File Updated:** `src/orchestrator/orchestrator.ts`

#### Milestone 8: Testing & Validation ✅

| Task | Status | Notes |
|------|--------|-------|
| 8.1 test-wallet.ts | ✅ Done | `npm run test:wallet` |
| 8.2 test-payment.ts | ✅ Done | `npm run test:payment` |
| 8.3 test-x402-flow.ts | ✅ Done | `npm run test:x402` |

**Test Scripts:**
```bash
npm run test:wallet     # Check wallet configuration
npm run test:payment    # Test USDC transfers (requires funds)
npm run test:x402       # Simulate x402 payment flow
npm run typecheck       # Verify TypeScript compilation
```

---

## ALL MILESTONES COMPLETE ✅

**TypeScript Compilation**: ✅ Passes with no errors

**To test with real payments:**
1. Set `ORCHESTRATOR_PRIVATE_KEY` in `.env`
2. Fund wallet with testnet USDC: https://www.coinbase.com/faucets/base-sepolia
3. Run: `npm run test:payment <recipient_address> <amount>`

---

## Current State (After Implementation)

### Payment Files
```
src/services/payment/
├── mock.ts    ✅ Working - logs payments, always succeeds
└── real.ts    ✅ IMPLEMENTED - Real USDC transfers on Base Sepolia
```

### Current Payment Interface
```typescript
interface IPaymentService {
  requestPayment(agentId: string, amount: number): Promise<PaymentRequest>;
  verifyPayment(signature: string): Promise<boolean>;
  sendBonus(walletAddress: string, amount: number): Promise<string>;
}
```

### How Payments Are Used
1. **Orchestrator** (`orchestrator.ts:132-151`): Calls `sendBonus()` to pay winning agents
2. **Agent Config** (`config.ts:13-35`): Each agent has `walletAddress` field
3. **No x402 middleware** on agent servers currently

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              CDP Server Wallet (Orchestrator)                 │  │
│  │              - Signs payment payloads                         │  │
│  │              - Sends USDC bounties to winners                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬──────────────────────────────────────┘
                              │ x402 Payment Flow
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Agent Llama  │ │ Agent Qwen   │ │ Agent DeepSeek│
    │              │ │              │ │              │
    │ x402 Paywall │ │ x402 Paywall │ │ x402 Paywall │
    │ (optional)   │ │ (optional)   │ │ (optional)   │
    │              │ │              │ │              │
    │ CDP Wallet   │ │ CDP Wallet   │ │ CDP Wallet   │
    │ (receives $) │ │ (receives $) │ │ (receives $) │
    └──────────────┘ └──────────────┘ └──────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                    ┌─────────────────┐
                    │    MongoDB      │
                    │ - Payment Logs  │
                    │ - Budget State  │
                    │ - Tx History    │
                    └─────────────────┘
```

---

## Milestone 1: Environment & Dependencies Setup

### 1.1 Install Required Packages

```bash
# x402 Protocol SDK
npm install @x402/core @x402/evm @x402/express @x402/fetch

# CDP SDK for wallet management
npm install @coinbase/cdp-sdk

# Viem for EVM interactions
npm install viem

# Ethers.js (alternative/backup)
npm install ethers
```

### 1.2 Environment Variables

Add to `.env`:
```bash
# ============ X402 & CDP Configuration ============

# CDP API Credentials (get from https://portal.cdp.coinbase.com)
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=

# Network Configuration
X402_NETWORK=base                    # or base-sepolia for testing
X402_FACILITATOR_URL=https://x402.coinbase.com

# Orchestrator Wallet (sends bounties)
ORCHESTRATOR_WALLET_ID=              # CDP wallet ID
# OR import from private key:
ORCHESTRATOR_PRIVATE_KEY=

# Agent Wallets (receive bounties) - Can be addresses or CDP wallet IDs
AGENT_LLAMA_WALLET=0x...
AGENT_QWEN_WALLET=0x...
AGENT_DEEPSEEK_WALLET=0x...

# USDC Contract Address
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # Base mainnet
# USDC_CONTRACT_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # Base Sepolia testnet
```

### 1.3 Update Config (`src/config.ts`)

```typescript
export const config = {
  // ... existing config ...

  x402: {
    network: process.env.X402_NETWORK || 'base-sepolia',
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.coinbase.com',
    usdcAddress: process.env.USDC_CONTRACT_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },

  cdp: {
    apiKeyId: process.env.CDP_API_KEY_ID || '',
    apiKeySecret: process.env.CDP_API_KEY_SECRET || '',
    walletSecret: process.env.CDP_WALLET_SECRET || '',
  },

  orchestrator: {
    walletId: process.env.ORCHESTRATOR_WALLET_ID || '',
    privateKey: process.env.ORCHESTRATOR_PRIVATE_KEY || '',
  },
};
```

**Deliverables:**
- [x] Package.json updated with new dependencies ✅
- [x] .env.example updated with all required variables ✅
- [x] config.ts extended with x402 and CDP settings ✅

---

## Milestone 2: CDP Wallet Integration

### 2.1 Create Wallet Service (`src/services/wallet/`)

**File: `src/services/wallet/types.ts`**
```typescript
export interface IWalletService {
  getAddress(): Promise<string>;
  signPaymentPayload(payload: PaymentPayload): Promise<string>;
  sendUSDC(to: string, amount: number): Promise<string>;
  getBalance(): Promise<number>;
}

export interface PaymentPayload {
  recipient: string;
  amount: string;
  nonce: string;
  deadline: number;
}
```

**File: `src/services/wallet/cdp-wallet.ts`**
```typescript
import { CdpClient } from '@coinbase/cdp-sdk';
import type { IWalletService, PaymentPayload } from './types.js';

export class CDPWalletService implements IWalletService {
  private client: CdpClient;
  private account: any;

  constructor(private walletId?: string) {
    this.client = new CdpClient();
  }

  async initialize(): Promise<void> {
    if (this.walletId) {
      // Load existing wallet
      this.account = await this.client.evm.getAccount(this.walletId);
    } else {
      // Create new wallet
      this.account = await this.client.evm.createAccount();
    }
  }

  async getAddress(): Promise<string> {
    return this.account.address;
  }

  async signPaymentPayload(payload: PaymentPayload): Promise<string> {
    // Sign the x402 payment payload
    const signature = await this.account.signTypedData({
      // EIP-712 typed data for x402
    });
    return signature;
  }

  async sendUSDC(to: string, amount: number): Promise<string> {
    // Use CDP to send USDC
    const tx = await this.account.sendTransaction({
      to: config.x402.usdcAddress,
      data: encodeTransfer(to, amount),
    });
    return tx.hash;
  }

  async getBalance(): Promise<number> {
    // Query USDC balance
  }
}
```

**File: `src/services/wallet/viem-wallet.ts`** (Private Key Alternative)
```typescript
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import type { IWalletService, PaymentPayload } from './types.js';

export class ViemWalletService implements IWalletService {
  private walletClient: any;
  private account: any;

  constructor(privateKey: string, network: 'base' | 'base-sepolia' = 'base-sepolia') {
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
    this.walletClient = createWalletClient({
      account: this.account,
      chain: network === 'base' ? base : baseSepolia,
      transport: http(),
    });
  }

  async getAddress(): Promise<string> {
    return this.account.address;
  }

  async signPaymentPayload(payload: PaymentPayload): Promise<string> {
    return this.walletClient.signTypedData({
      // EIP-712 typed data
    });
  }

  async sendUSDC(to: string, amount: number): Promise<string> {
    // Implement USDC transfer
  }

  async getBalance(): Promise<number> {
    // Query balance
  }
}
```

**Deliverables:**
- [x] `src/services/wallet/types.ts` - Interface definitions ✅
- [x] `src/services/wallet/cdp-wallet.ts` - CDP SDK implementation ✅
- [x] `src/services/wallet/viem-wallet.ts` - Direct private key implementation ✅
- [x] `src/services/wallet/index.ts` - Factory function ✅

---

## Milestone 3: Real Payment Service Implementation

### 3.1 Implement RealPaymentService (`src/services/payment/real.ts`)

```typescript
import type { IPaymentService } from '../../types/services.js';
import type { PaymentRequest } from '../../types/index.js';
import { config } from '../../config.js';
import { createWalletService } from '../wallet/index.js';
import { createPublicClient, http, encodeFunctionData, parseUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// USDC ERC20 ABI (minimal for transfer)
const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export class RealPaymentService implements IPaymentService {
  private walletService: any;
  private publicClient: any;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create wallet service based on config
    this.walletService = await createWalletService({
      type: config.cdp.apiKeyId ? 'cdp' : 'viem',
      privateKey: config.orchestrator.privateKey,
      walletId: config.orchestrator.walletId,
    });

    // Create public client for reading chain state
    const chain = config.x402.network === 'base' ? base : baseSepolia;
    this.publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    this.initialized = true;
    console.log('[RealPayment] Initialized with wallet:', await this.walletService.getAddress());
  }

  async requestPayment(agentId: string, amount: number): Promise<PaymentRequest> {
    await this.initialize();

    // Create a payment request (for x402 middleware scenario)
    const paymentId = `pay_${Date.now()}_${agentId}`;

    console.log(`[RealPayment] Payment request created for ${agentId}: ${amount} USDC`);

    return {
      paymentId,
      amount,
      status: 'pending',
    };
  }

  async verifyPayment(signature: string): Promise<boolean> {
    await this.initialize();

    // Verify x402 payment signature
    // In production, this would verify against the facilitator
    try {
      const response = await fetch(`${config.x402.facilitatorUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });

      const result = await response.json();
      return result.valid === true;
    } catch (error) {
      console.error('[RealPayment] Verification failed:', error);
      return false;
    }
  }

  async sendBonus(walletAddress: string, amount: number): Promise<string> {
    await this.initialize();

    console.log(`[RealPayment] Sending ${amount} USDC to ${walletAddress}`);

    try {
      // Convert amount to USDC units (6 decimals)
      const amountInUnits = parseUnits(amount.toString(), 6);

      // Encode the transfer call
      const data = encodeFunctionData({
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [walletAddress as `0x${string}`, amountInUnits],
      });

      // Send transaction via wallet service
      const txHash = await this.walletService.sendTransaction({
        to: config.x402.usdcAddress,
        data,
        value: 0n,
      });

      console.log(`[RealPayment] Transaction sent: ${txHash}`);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        console.log(`[RealPayment] Payment confirmed in block ${receipt.blockNumber}`);
        return txHash;
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (error) {
      console.error('[RealPayment] Failed to send bonus:', error);
      throw error;
    }
  }

  async getBalance(): Promise<number> {
    await this.initialize();

    const address = await this.walletService.getAddress();
    const balance = await this.publicClient.readContract({
      address: config.x402.usdcAddress as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    return Number(balance) / 1e6; // Convert from 6 decimals
  }
}
```

**Deliverables:**
- [ ] `src/services/payment/real.ts` - Full implementation
- [ ] Unit tests for payment service
- [ ] Integration test with Base Sepolia testnet

---

## Milestone 4: X402 Middleware for Agent Servers (Optional)

This milestone adds pay-per-call functionality to agent endpoints.

### 4.1 Create X402 Middleware (`src/agents/x402-middleware.ts`)

```typescript
import { paymentMiddleware } from '@x402/express';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export interface X402Config {
  pricePerCall: number;  // USDC amount per solve request
  recipientAddress: string;
}

export function createX402Middleware(x402Config: X402Config) {
  return paymentMiddleware({
    'POST /solve': {
      price: {
        amount: x402Config.pricePerCall.toString(),
        currency: 'USDC',
      },
      recipient: x402Config.recipientAddress,
      network: config.x402.network,
      description: 'AI Agent Solution Generation',

      // Use Coinbase facilitator
      facilitator: config.x402.facilitatorUrl,
    },
  });
}

// Alternative: Manual x402 implementation for full control
export function createManualX402Middleware(x402Config: X402Config) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check for payment header
    const paymentHeader = req.headers['x-payment'] as string;

    if (!paymentHeader && req.path === '/solve' && req.method === 'POST') {
      // Return 402 Payment Required
      res.status(402).json({
        status: 402,
        message: 'Payment Required',
        paymentDetails: {
          amount: x402Config.pricePerCall,
          currency: 'USDC',
          recipient: x402Config.recipientAddress,
          network: config.x402.network,
          scheme: 'exact',
        },
      });
      return;
    }

    if (paymentHeader) {
      // Verify payment with facilitator
      try {
        const verifyResponse = await fetch(`${config.x402.facilitatorUrl}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment: paymentHeader }),
        });

        if (!verifyResponse.ok) {
          res.status(402).json({ error: 'Payment verification failed' });
          return;
        }

        // Payment verified, continue
        next();
      } catch (error) {
        res.status(500).json({ error: 'Payment verification error' });
      }
    } else {
      // No payment required for this route
      next();
    }
  };
}
```

### 4.2 Update Agent Server (`src/agents/agent-server.ts`)

```typescript
import { createX402Middleware } from './x402-middleware.js';

export class AgentServer {
  constructor(
    private agentConfig: AgentConfig,
    llmService: ILLMService,
    private enablePaywall: boolean = false  // New option
  ) {
    // ... existing constructor ...
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // Add x402 paywall if enabled
    if (this.enablePaywall && this.agentConfig.walletAddress) {
      this.app.use(createX402Middleware({
        pricePerCall: 0.01,  // $0.01 per solve request
        recipientAddress: this.agentConfig.walletAddress,
      }));
    }

    // ... existing middleware ...
  }
}
```

**Deliverables:**
- [ ] `src/agents/x402-middleware.ts` - Payment gate middleware
- [ ] Updated `agent-server.ts` with optional paywall
- [ ] Update config for per-agent paywall settings

---

## Milestone 5: Extended Types & Payment Tracking

### 5.1 Extend Types (`src/types/index.ts`)

```typescript
// Add to existing types

export interface PaymentRequest {
  paymentId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;        // Blockchain transaction hash
  recipient?: string;     // Wallet address
  timestamp?: number;     // When payment was made
  network?: string;       // 'base' | 'base-sepolia'
}

export interface PaymentRecord {
  id: string;
  competitionId: string;
  agentId: string;
  walletAddress: string;
  amount: number;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: number;
  confirmedAt?: number;
  blockNumber?: number;
}

export interface WalletInfo {
  address: string;
  balance: number;
  network: string;
}

// Extend Competition type
export interface Competition {
  // ... existing fields ...
  paymentRecord?: PaymentRecord;  // Track the winning payment
}
```

### 5.2 Extend Service Interface (`src/types/services.ts`)

```typescript
// Extend IPaymentService
export interface IPaymentService {
  requestPayment(agentId: string, amount: number): Promise<PaymentRequest>;
  verifyPayment(signature: string): Promise<boolean>;
  sendBonus(walletAddress: string, amount: number): Promise<string>;

  // New methods
  getBalance?(): Promise<number>;
  getPaymentHistory?(agentId?: string): Promise<PaymentRecord[]>;
}
```

**Deliverables:**
- [ ] Extended `src/types/index.ts`
- [ ] Extended `src/types/services.ts`
- [ ] Updated mock service to match new interface

---

## Milestone 6: MongoDB Payment Persistence

### 6.1 Extend MongoDB State Store

**File: `src/services/state/real.ts`** (extend existing)

```typescript
import { MongoClient, Db, Collection } from 'mongodb';
import type { IStateStore } from '../../types/services.js';
import type { Competition, PaymentRecord } from '../../types/index.js';
import { config } from '../../config.js';

export class MongoStateStore implements IStateStore {
  private client: MongoClient;
  private db: Db;
  private competitions: Collection<Competition>;
  private payments: Collection<PaymentRecord>;  // New collection

  async connect(): Promise<void> {
    this.client = new MongoClient(config.mongodb.uri);
    await this.client.connect();
    this.db = this.client.db('codebounty');
    this.competitions = this.db.collection('competitions');
    this.payments = this.db.collection('payments');

    // Create indexes
    await this.payments.createIndex({ competitionId: 1 });
    await this.payments.createIndex({ agentId: 1 });
    await this.payments.createIndex({ txHash: 1 }, { unique: true });
    await this.payments.createIndex({ createdAt: -1 });
  }

  // ... existing methods ...

  // New payment tracking methods
  async savePaymentRecord(record: PaymentRecord): Promise<void> {
    await this.payments.insertOne(record);
  }

  async updatePaymentRecord(
    txHash: string,
    updates: Partial<PaymentRecord>
  ): Promise<void> {
    await this.payments.updateOne(
      { txHash },
      { $set: updates }
    );
  }

  async getPaymentsByAgent(agentId: string): Promise<PaymentRecord[]> {
    return this.payments.find({ agentId }).sort({ createdAt: -1 }).toArray();
  }

  async getPaymentsByCompetition(competitionId: string): Promise<PaymentRecord[]> {
    return this.payments.find({ competitionId }).toArray();
  }

  async getTotalPaidToAgent(agentId: string): Promise<number> {
    const result = await this.payments.aggregate([
      { $match: { agentId, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray();

    return result[0]?.total || 0;
  }
}
```

**Deliverables:**
- [ ] Extended MongoDB schema with payments collection
- [ ] Payment tracking methods
- [ ] Indexes for efficient queries

---

## Milestone 7: Orchestrator Integration

### 7.1 Update Orchestrator (`src/orchestrator/orchestrator.ts`)

```typescript
import { nanoid } from 'nanoid';
import type { Services } from '../types/services.js';
import type { Competition, PaymentRecord } from '../types/index.js';

export class Orchestrator {
  constructor(private services: Services) {}

  // ... existing methods ...

  /**
   * Pay the winner with real USDC and track the payment
   */
  private async payWinner(competition: Competition): Promise<void> {
    if (!competition.winner) return;

    const agentConfig = config.agents.find((a) => a.id === competition.winner);
    if (!agentConfig?.walletAddress) {
      console.error(`No wallet address found for winner: ${competition.winner}`);
      return;
    }

    // Create payment record
    const paymentRecord: PaymentRecord = {
      id: nanoid(),
      competitionId: competition.id,
      agentId: competition.winner,
      walletAddress: agentConfig.walletAddress,
      amount: competition.bountyAmount,
      txHash: '',
      status: 'pending',
      createdAt: Date.now(),
    };

    try {
      // Log balance before payment
      if (this.services.payment.getBalance) {
        const balance = await this.services.payment.getBalance();
        console.log(`[Orchestrator] Current balance: ${balance} USDC`);

        if (balance < competition.bountyAmount) {
          throw new Error(`Insufficient balance: ${balance} < ${competition.bountyAmount}`);
        }
      }

      // Send the payment
      const txHash = await this.services.payment.sendBonus(
        agentConfig.walletAddress,
        competition.bountyAmount
      );

      // Update payment record with tx hash
      paymentRecord.txHash = txHash;
      paymentRecord.status = 'confirmed';
      paymentRecord.confirmedAt = Date.now();

      console.log(`[Orchestrator] Bounty paid to ${competition.winner}: ${txHash}`);

      // Persist payment record (if using real state store)
      if ('savePaymentRecord' in this.services.state) {
        await (this.services.state as any).savePaymentRecord(paymentRecord);
      }

      // Update competition with payment info
      competition.paymentRecord = paymentRecord;

    } catch (error) {
      paymentRecord.status = 'failed';
      console.error(`[Orchestrator] Payment failed for ${competition.winner}:`, error);

      // Still save the failed record for debugging
      if ('savePaymentRecord' in this.services.state) {
        await (this.services.state as any).savePaymentRecord(paymentRecord);
      }

      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    totalPaid: number;
    paymentsCount: number;
    balanceRemaining: number;
  }> {
    const balance = await this.services.payment.getBalance?.() ?? 0;

    // Get stats from state store
    // ...

    return {
      totalPaid: 0,  // Calculate from records
      paymentsCount: 0,
      balanceRemaining: balance,
    };
  }
}
```

**Deliverables:**
- [ ] Updated orchestrator with payment tracking
- [ ] Balance checking before payments
- [ ] Payment statistics method

---

## Milestone 8: Testing & Validation

### 8.1 Test Checklist

**Unit Tests:**
- [ ] CDP wallet service initialization
- [ ] Viem wallet service initialization
- [ ] USDC amount encoding (6 decimals)
- [ ] Payment request creation
- [ ] Signature verification

**Integration Tests (Base Sepolia):**
- [ ] Create test wallet via CDP
- [ ] Fund wallet with testnet USDC from faucet
- [ ] Send USDC to another address
- [ ] Verify transaction on block explorer
- [ ] Test x402 middleware payment flow

### 8.2 Testnet Resources

```
Base Sepolia Faucet: https://www.coinbase.com/faucets/base-sepolia
Base Sepolia Explorer: https://sepolia.basescan.org
Test USDC (Sepolia): 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### 8.3 Test Script

**File: `scripts/test-payment.ts`**
```typescript
import { config } from '../src/config.js';
import { RealPaymentService } from '../src/services/payment/real.js';

async function testPayment() {
  console.log('Testing real payment service...\n');

  const paymentService = new RealPaymentService();

  // Check balance
  const balance = await paymentService.getBalance();
  console.log(`Current balance: ${balance} USDC\n`);

  if (balance < 1) {
    console.log('Insufficient balance for test. Fund the wallet first.');
    return;
  }

  // Send small test payment
  const testRecipient = '0x...'; // Your test address
  const txHash = await paymentService.sendBonus(testRecipient, 0.01);

  console.log(`Payment sent! TX: ${txHash}`);
  console.log(`View on explorer: https://sepolia.basescan.org/tx/${txHash}`);
}

testPayment().catch(console.error);
```

**Deliverables:**
- [ ] Unit test suite
- [ ] Integration test script
- [ ] Documented testing procedure

---

## File Structure Summary

```
src/
├── services/
│   ├── wallet/
│   │   ├── types.ts           # NEW: Wallet interface
│   │   ├── cdp-wallet.ts      # NEW: CDP SDK implementation
│   │   ├── viem-wallet.ts     # NEW: Viem implementation
│   │   └── index.ts           # NEW: Factory function
│   │
│   ├── payment/
│   │   ├── mock.ts            # EXISTS: Update interface
│   │   └── real.ts            # UPDATE: Full implementation
│   │
│   └── state/
│       └── real.ts            # UPDATE: Add payment tracking
│
├── agents/
│   ├── agent-server.ts        # UPDATE: Add paywall option
│   └── x402-middleware.ts     # NEW: Payment gate middleware
│
├── types/
│   ├── index.ts               # UPDATE: Add payment types
│   └── services.ts            # UPDATE: Extend interface
│
├── config.ts                  # UPDATE: Add x402/CDP config
│
└── orchestrator/
    └── orchestrator.ts        # UPDATE: Payment tracking
```

---

## Implementation Order

| Phase | Tasks | Priority |
|-------|-------|----------|
| **1** | Dependencies + Config | Critical |
| **2** | Wallet Service (CDP + Viem) | Critical |
| **3** | Real Payment Service | Critical |
| **4** | Orchestrator Integration | Critical |
| **5** | Extended Types | High |
| **6** | MongoDB Payment Tracking | Medium |
| **7** | X402 Agent Middleware | Optional |
| **8** | Testing & Validation | Critical |

---

## Quick Start Commands

```bash
# 1. Install dependencies
npm install @x402/core @x402/evm @x402/express @x402/fetch @coinbase/cdp-sdk viem ethers

# 2. Set up environment
cp .env.example .env
# Fill in CDP credentials and wallet info

# 3. Test on Sepolia
export X402_NETWORK=base-sepolia
npm run test:payment

# 4. Switch to mainnet when ready
export X402_NETWORK=base
export MOCK_PAYMENT=false
npm run dev:tui
```

---

## Resources

- [x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 GitHub Repository](https://github.com/coinbase/x402)
- [CDP SDK TypeScript](https://coinbase.github.io/cdp-sdk/typescript/)
- [CDP Wallets Documentation](https://docs.cdp.coinbase.com/server-wallets/v2/introduction/quickstart)
- [Base Network](https://base.org)
- [Viem Documentation](https://viem.sh)
