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
    // Fireworks Models
    {
      id: 'llama',
      name: 'Llama',
      model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      provider: 'fireworks',
      port: 3001,
      walletAddress: process.env.AGENT_LLAMA_WALLET,
      costPerToken: 0.000025,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.25,
    },
    {
      id: 'qwen',
      name: 'Qwen',
      model: 'accounts/fireworks/models/qwen3-coder-30b-a3b-instruct',
      provider: 'fireworks',
      port: 3002,
      walletAddress: process.env.AGENT_QWEN_WALLET,
      costPerToken: 0.000015,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.20,
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      model: 'accounts/fireworks/models/deepseek-v3p2',
      provider: 'fireworks',
      port: 3003,
      walletAddress: process.env.AGENT_DEEPSEEK_WALLET,
      costPerToken: 0.00004,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.30,
    },
    // OpenAI
    {
      id: 'gpt',
      name: 'GPT-4o',
      model: 'gpt-4o',
      provider: 'openai',
      port: 3004,
      walletAddress: process.env.AGENT_GPT_WALLET,
      costPerToken: 0.00001,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.25,
    },
    // Anthropic
    {
      id: 'opus',
      name: 'Claude Opus',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      port: 3005,
      walletAddress: process.env.AGENT_OPUS_WALLET,
      costPerToken: 0.000015,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.25,
    },
    // Google
    {
      id: 'gemini',
      name: 'Gemini',
      model: 'gemini-2.0-flash',
      provider: 'google',
      port: 3006,
      walletAddress: process.env.AGENT_GEMINI_WALLET,
      costPerToken: 0.000001,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.20,
    },
    // xAI
    {
      id: 'grok',
      name: 'Grok',
      model: 'grok-3',
      provider: 'xai',
      port: 3007,
      walletAddress: process.env.AGENT_GROK_WALLET,
      costPerToken: 0.00001,
      avgTokensPerSolution: 2000,
      minimumMargin: 0.25,
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
