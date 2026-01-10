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

| Agent | Port | Model |
|-------|------|-------|
| Llama | 3001 | llama-v3p1-70b-instruct |
| Qwen | 3002 | qwen2p5-coder-32b-instruct |
| DeepSeek | 3003 | deepseek-v3 |

---

## 6. Using Real Services

Update `.env` to switch from mocks:

```bash
# Real LLM
MOCK_LLM=false
FIREWORKS_API_KEY=your-key

# Real Payments
MOCK_PAYMENT=false
# See todos/x402-payment-integration-plan.md
```

---

## 7. Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:tui` | Run TUI (dev mode) |
| `npm run dev:agents` | Run agent servers (dev mode) |
| `npm run build` | Compile TypeScript |
