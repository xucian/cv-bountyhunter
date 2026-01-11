import 'dotenv/config';
import type { AgentConfig } from './types/index.js';

export const config = {
  useMocks: {
    github: process.env.MOCK_GITHUB !== 'false',
    llm: process.env.MOCK_LLM !== 'false',
    state: process.env.MOCK_STATE !== 'false',
    payment: process.env.MOCK_PAYMENT !== 'false',
    agents: process.env.MOCK_AGENTS !== 'false',
    reviewer: process.env.MOCK_REVIEWER !== 'false',
    rag: process.env.MOCK_RAG !== 'false',
  },

  agents: [
    {
      id: 'llama',
      name: 'Llama Agent',
      model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      port: 3001,
      walletAddress: process.env.AGENT_LLAMA_WALLET,
      // Economics: ~$0.05 cost per task (mid-tier)
      costPerToken: 0.000025,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.25, // needs $0.0625 min → accepts at $0.07+
    },
    {
      id: 'qwen',
      name: 'Qwen Agent',
      model: 'accounts/fireworks/models/qwen3-coder-30b-a3b-instruct',
      port: 3002,
      walletAddress: process.env.AGENT_QWEN_WALLET,
      // Economics: ~$0.03 cost per task (budget option)
      costPerToken: 0.000015,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.20, // needs $0.036 min → accepts at $0.04+
    },
    {
      id: 'deepseek',
      name: 'DeepSeek Agent',
      model: 'accounts/fireworks/models/deepseek-v3p2',
      port: 3003,
      walletAddress: process.env.AGENT_DEEPSEEK_WALLET,
      // Economics: ~$0.08 cost per task (premium)
      costPerToken: 0.00004,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.30, // needs $0.104 min → declines at $0.10!
    },
  ] as AgentConfig[],

  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY || '',
  },

  orchestrator: {
    privateKey: process.env.ORCHESTRATOR_PRIVATE_KEY || '',
    walletId: process.env.ORCHESTRATOR_WALLET_ID || '',
  },

  // X402 Protocol Configuration - TESTNET BY DEFAULT
  x402: {
    network: (process.env.X402_NETWORK || 'base-sepolia') as 'base' | 'base-sepolia',
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.coinbase.com',
    // Base Sepolia testnet USDC by default
    usdcAddress: process.env.USDC_CONTRACT_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },

  // CDP (Coinbase Developer Platform) Configuration
  cdp: {
    apiKeyId: process.env.CDP_API_KEY_ID || '',
    apiKeySecret: process.env.CDP_API_KEY_SECRET || '',
    walletSecret: process.env.CDP_WALLET_SECRET || '',
  },

  // RAG (Retrieval-Augmented Generation) Configuration
  rag: {
    indexMode: process.env.INDEX_MODE || 'ast',
    chunkLimit: parseInt(process.env.RAG_CHUNK_LIMIT || '10', 10),
  },

  // Voyage AI Configuration
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY || '',
    model: 'voyage-code-2',
    dimension: 1536,
  },

  // MongoDB Atlas Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || '',
    dbName: 'codebounty',
    collections: {
      chunks: 'code_chunks',
      competitions: 'competitions',
      payments: 'payments',
    },
  },
};
