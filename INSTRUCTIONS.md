# CodeBounty - Getting Started

Quick guide to run and test the CodeBounty AI agent competition system.

---

## Prerequisites

- **Node.js** v18+ or **Bun** runtime
- Terminal that supports ANSI colors

---

## 1. Install Dependencies

```bash
# Using npm
npm install

# Or using bun (faster)
bun install
```

---

## 2. Setup Environment

```bash
cp .env.example .env
```

Default uses mocks - everything works out of the box.

---

## 3. Running the Application

### Option A: TUI Only (Quick Demo)

```bash
npm run dev:tui
```

This launches the terminal UI where you can:

1. Enter a GitHub repo URL
2. Enter an issue number
3. Set a bounty amount
4. Watch 3 AI agents race to solve the issue

**Controls:** `Tab` to navigate, `Enter` to submit, `Ctrl+C` to exit

---

### Option B: Full Stack (Agents + TUI)

**Terminal 1 - Start Agent Servers:**

```bash
npm run dev:agents
```

**Terminal 2 - Start TUI:**

```bash
npm run dev:tui
```

---

## 4. Testing Agent Endpoints

Once agents are running:

```bash
# Health check
curl http://localhost:3001/health

# Solve an issue
curl -X POST http://localhost:3001/solve \
  -H "Content-Type: application/json" \
  -d '{
    "issue": {
      "number": 42,
      "title": "Fix null pointer exception",
      "body": "App crashes when user has no avatar",
      "repoUrl": "https://github.com/example/repo",
      "labels": ["bug"]
    }
  }'
```

---

## 5. Agent Ports

| Agent    | Port | Model                      |
| -------- | ---- | -------------------------- |
| Llama    | 3001 | llama-v3p1-70b-instruct    |
| Qwen     | 3002 | qwen2p5-coder-32b-instruct |
| DeepSeek | 3003 | deepseek-v3                |

---

## 6. Using Real Services

Update `.env` to switch from mocks:

```bash
# Real LLM
MOCK_LLM=false
FIREWORKS_API_KEY=your-key

# Real Payments
MOCK_PAYMENT=false
# See below for X402 setup
```

---

## 7. X402 & CDP Wallet Setup (Real Payments)

To enable real USDC payments on Base Sepolia testnet, follow these steps:

### Step 1: Get CDP API Credentials

1. Go to [CDP Portal](https://portal.cdp.coinbase.com)
2. Sign in with your Coinbase account
3. Create a new project or select existing
4. Go to **API Keys** → **Create API Key**
5. Copy the values to `.env`:
   ```bash
   CDP_API_KEY_ID=your-api-key-id
   CDP_API_KEY_SECRET=your-api-key-secret
   ```

### Step 2: Generate a Wallet Secret (From CDP Portal!)

> ⚠️ **IMPORTANT**: The Wallet Secret is NOT something you generate yourself. It must be created in the CDP Portal.

1. Go to [CDP Portal - Server Wallet](https://portal.cdp.coinbase.com/products/server-wallet/accounts)
2. Click **"Generate Wallet Secret"**
3. **Save the secret immediately** — it's only shown once!
4. Add to `.env`:

```bash
CDP_WALLET_SECRET=the-secret-from-portal
```

> ⚠️ **CRITICAL**: If you lose this secret, you lose access to all CDP-created wallets!

### Step 3: Create All Wallets (One Command)

**Recommended: Use the automated setup script**

```bash
npm run setup:wallets
```

This creates 1 orchestrator + 3 agent wallets via CDP. Copy the output to your `.env`.

**Alternative: Manual private key setup**

```bash
# Export from MetaMask or generate your own
ORCHESTRATOR_PRIVATE_KEY=0xYourPrivateKeyHere
AGENT_LLAMA_WALLET=0x...
AGENT_QWEN_WALLET=0x...
AGENT_DEEPSEEK_WALLET=0x...
```

### Step 4: Fund with Testnet USDC

1. Get Base Sepolia ETH (for gas): [Coinbase Faucet](https://www.coinbase.com/faucets/base-sepolia)
2. Get testnet USDC from a faucet or bridge
3. Send to your orchestrator wallet address

### Step 6: Test the Setup

```bash
# Verify wallet configuration
npm run test:wallet

# Test a small payment (requires funds)
npm run test:payment 0xRecipientAddress 0.01

# Simulate x402 flow
npm run test:x402
```

### Quick Reference

| Variable                   | How to Get                                   |
| -------------------------- | -------------------------------------------- |
| `CDP_API_KEY_ID`           | CDP Portal → API Keys                        |
| `CDP_API_KEY_SECRET`       | CDP Portal → API Keys                        |
| `CDP_WALLET_SECRET`        | Generate yourself: `openssl rand -hex 32`    |
| `ORCHESTRATOR_PRIVATE_KEY` | Export from any wallet (MetaMask, etc.)      |
| `AGENT_*_WALLET`           | Any Ethereum address (just needs to receive) |

### Resources

- [CDP Portal](https://portal.cdp.coinbase.com)
- [CDP SDK Docs](https://docs.cdp.coinbase.com/server-wallets/v2/introduction/quickstart)
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-sepolia)
- [Base Sepolia Explorer](https://sepolia.basescan.org)

---

## 8. Scripts

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev:tui`       | Run TUI (dev mode)                       |
| `npm run dev:agents`    | Run agent servers (dev mode)             |
| `npm run build`         | Compile TypeScript                       |
| `npm run setup:wallets` | Create wallets via CDP (one-time setup)  |
| `npm run test:wallet`   | Verify wallet configuration              |
| `npm run test:payment`  | Test USDC transfer (requires ETH + USDC) |
| `npm run test:x402`     | Simulate x402 payment flow               |

---

## 9. X402 Payment Flow

The `npm run test:x402` command simulates the x402 "pay-per-request" protocol flow.

### What It Tests

1. **Payment service initialization** - Validates CDP/wallet configuration
2. **402 response simulation** - Shows the payment requirement header format
3. **Payment request creation** - Creates a tracked payment request
4. **Signature verification** - Tests verification via facilitator

### X402 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        X402 PAYMENT FLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                           ┌──────────────────┐    │
│  │    CLIENT    │                           │  AGENT SERVER    │    │
│  │   (Buyer)    │                           │    (Seller)      │    │
│  └──────┬───────┘                           └────────┬─────────┘    │
│         │                                            │              │
│         │  1. POST /solve                            │              │
│         │    (no payment)                            │              │
│         ├───────────────────────────────────────────►│              │
│         │                                            │              │
│         │  2. HTTP 402 Payment Required              │              │
│         │    X-Payment-Required: {                   │              │
│         │      amount: "0.01",                       │              │
│         │      currency: "USDC",                     │              │
│         │      recipient: "0xAgent...",              │              │
│         │      network: "base-sepolia"               │              │
│         │    }                                       │              │
│         │◄───────────────────────────────────────────┤              │
│         │                                            │              │
│         │  3. Wallet signs payment payload           │              │
│         │     (Client-side signature)                │              │
│         │                                            │              │
│         │  4. POST /solve                            │              │
│         │    X-Payment: <signed_payload>             │              │
│         ├───────────────────────────────────────────►│              │
│         │                                            │              │
│         │                    5. Verify via           │              │
│         │                       Facilitator          │              │
│         │                           │                │              │
│         │                           ▼                │              │
│         │                    ┌─────────────┐         │              │
│         │                    │ x402.org or │         │              │
│         │                    │ CDP API     │         │              │
│         │                    └─────────────┘         │              │
│         │                           │                │              │
│         │                    6. Payment settled      │              │
│         │                       on blockchain        │              │
│         │                                            │              │
│         │  7. HTTP 200 + Response                    │              │
│         │◄───────────────────────────────────────────┤              │
│         │                                            │              │
└─────────┴────────────────────────────────────────────┴──────────────┘
```

### Money Flow (Full Competition Cycle)

This shows what happens during a single bounty competition:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                        CODEBOUNTY MONEY FLOW                                   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ┌──────────────────────────────────────────────────────────────────────────┐  ║
║  │                           BEFORE COMPETITION                              │  ║
║  └──────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
║     USER (you)                 ORCHESTRATOR                 AGENTS             ║
║  ┌────────────┐              ┌────────────┐                                    ║
║  │ Funds the  │──── $ ─────►│ 10.00 USDC │        ┌───────────────────────┐   ║
║  │ orchestrator│             │ 0.05 ETH   │        │ Agent Llama:  0 USDC  │   ║
║  │ wallet     │              │ (gas)      │        │ Agent Qwen:   0 USDC  │   ║
║  └────────────┘              └────────────┘        │ Agent DeepSeek: 0 USDC│   ║
║                                                    └───────────────────────┘   ║
║                                                                                ║
║  ┌──────────────────────────────────────────────────────────────────────────┐  ║
║  │                       COMPETITION STARTS                                  │  ║
║  │                                                                           │  ║
║  │   Issue: "Fix bug #42 in auth module"                                     │  ║
║  │   Bounty: 1.00 USDC                                                       │  ║
║  │                                                                           │  ║
║  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │  ║
║  │   │ Agent Llama │    │ Agent Qwen  │    │ Agent Deep  │                  │  ║
║  │   │             │    │             │    │             │                  │  ║
║  │   │  Working... │    │  Working... │    │  Working... │                  │  ║
║  │   │             │    │             │    │             │                  │  ║
║  │   │  Score: 72  │    │  Score: 85  │    │  Score: 68  │◄─── AI Judge    │  ║
║  │   └─────────────┘    └─────────────┘    └─────────────┘      evaluates   │  ║
║  │                            ▲                                              │  ║
║  │                            │                                              │  ║
║  │                        🏆 WINNER                                          │  ║
║  └──────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
║  ┌──────────────────────────────────────────────────────────────────────────┐  ║
║  │                        PAYMENT (sendBonus)                                │  ║
║  │                                                                           │  ║
║  │   ORCHESTRATOR                                                AGENTS      │  ║
║  │  ┌────────────┐                                                           │  ║
║  │  │ 10.00 USDC │                                                           │  ║
║  │  │            │────────── 1.00 USDC ──────────►  Agent Qwen 🏆            │  ║
║  │  │ -gas fee   │           (bounty)               (receives bounty)        │  ║
║  │  └────────────┘                                                           │  ║
║  │                                                                           │  ║
║  │   Transaction: 0xa392...5955                                              │  ║
║  │   Block: 36156948                                                         │  ║
║  │   Network: Base Sepolia                                                   │  ║
║  └──────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
║  ┌──────────────────────────────────────────────────────────────────────────┐  ║
║  │                            AFTER COMPETITION                              │  ║
║  └──────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
║     USER                      ORCHESTRATOR                 AGENTS             ║
║  ┌────────────┐              ┌────────────┐        ┌───────────────────────┐   ║
║  │ (observer) │              │ 9.00 USDC  │        │ Agent Llama:  0 USDC  │   ║
║  │            │              │ ~0.049 ETH │        │ Agent Qwen:   1 USDC 🏆│  ║
║  └────────────┘              └────────────┘        │ Agent DeepSeek: 0 USDC│   ║
║                                                    └───────────────────────┘   ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Balance Summary (After Multiple Competitions)

| Wallet             | Role              | Balance After 5 Competitions   |
| ------------------ | ----------------- | ------------------------------ |
| **Orchestrator**   | Prize pool holder | Started: 10 USDC → Now: 5 USDC |
| **Agent Llama**    | Won 2 times       | 2.00 USDC                      |
| **Agent Qwen**     | Won 2 times       | 2.00 USDC                      |
| **Agent DeepSeek** | Won 1 time        | 1.00 USDC                      |

### Key Points

1. **User** funds the orchestrator wallet (one-time or periodic)
2. **Orchestrator** holds the prize pool and pays winners
3. **Agents** only receive money when they win (no upfront costs)
4. **Gas fees** (~$0.01 per tx on Base) are paid by orchestrator

### Facilitator URLs

| Environment | URL                                             | Auth Required |
| ----------- | ----------------------------------------------- | ------------- |
| **Testnet** | `https://x402.org/facilitator`                  | No            |
| **Mainnet** | `https://api.cdp.coinbase.com/platform/v2/x402` | Yes (CDP API) |
