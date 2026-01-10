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
  },

  agents: [
    {
      id: 'llama',
      name: 'Llama Agent',
      model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      port: 3001,
      walletAddress: process.env.AGENT_LLAMA_WALLET,
    },
    {
      id: 'qwen',
      name: 'Qwen Agent',
      model: 'accounts/fireworks/models/qwen3-coder-30b-a3b-instruct',
      port: 3002,
      walletAddress: process.env.AGENT_QWEN_WALLET,
    },
    {
      id: 'deepseek',
      name: 'DeepSeek Agent',
      model: 'accounts/fireworks/models/deepseek-v3p2',
      port: 3003,
      walletAddress: process.env.AGENT_DEEPSEEK_WALLET,
    },
  ] as AgentConfig[],

  mongodb: {
    uri: process.env.MONGODB_URI || '',
  },

  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY || '',
  },

  orchestrator: {
    privateKey: process.env.ORCHESTRATOR_PRIVATE_KEY || '',
  },
};
