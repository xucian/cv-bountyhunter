import { config } from './config.js';
import { AgentServer } from './agents/agent-server.js';
import { MockLLMService, FireworksLLMService } from './services/llm.js';
import type { ILLMService } from './types/services.js';

/**
 * Launch all agent servers
 * Uses MockLLMService by default, or FireworksLLMService if MOCK_LLM=false
 */
async function launchAgents(): Promise<void> {
  console.log('='.repeat(60));
  console.log('CodeBounty Agent Launcher');
  console.log('='.repeat(60));
  console.log();

  // Create the LLM service based on config
  let llmService: ILLMService;

  if (config.useMocks.llm) {
    console.log('[launcher] Using MockLLMService');
    llmService = new MockLLMService();
  } else {
    if (!config.fireworks.apiKey) {
      console.error('[launcher] ERROR: FIREWORKS_API_KEY is required when MOCK_LLM=false');
      process.exit(1);
    }
    console.log('[launcher] Using FireworksLLMService');
    llmService = new FireworksLLMService(config.fireworks.apiKey);
  }

  console.log(`[launcher] Starting ${config.agents.length} agents...`);
  console.log();

  // Create and start all agent servers
  const servers: AgentServer[] = [];

  for (const agentConfig of config.agents) {
    const server = new AgentServer(agentConfig, llmService);
    servers.push(server);

    try {
      await server.start();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[launcher] Failed to start ${agentConfig.id}: ${errorMessage}`);

      // Stop any already-started servers
      for (const s of servers) {
        await s.stop().catch(() => {});
      }

      process.exit(1);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('All agents started successfully!');
  console.log('='.repeat(60));
  console.log();
  console.log('Agent endpoints:');
  for (const agentConfig of config.agents) {
    console.log(`  - ${agentConfig.name}: http://localhost:${agentConfig.port}`);
    console.log(`    Model: ${agentConfig.model}`);
    console.log(`    Health: http://localhost:${agentConfig.port}/health`);
    console.log(`    Solve:  POST http://localhost:${agentConfig.port}/solve`);
    console.log();
  }

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log();
    console.log(`[launcher] Received ${signal}, shutting down agents...`);

    for (const server of servers) {
      await server.stop().catch(() => {});
    }

    console.log('[launcher] All agents stopped. Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Run the launcher
launchAgents().catch((error) => {
  console.error('[launcher] Fatal error:', error);
  process.exit(1);
});
