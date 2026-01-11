/**
 * Debug runner - runs competition without TUI
 * Used when TUI_DEBUG_MODE=true
 */
import { createServices } from '../services/index.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';

export async function runDebugMode() {
  console.log('[Debug] Creating services...');
  const services = createServices();

  console.log('[Debug] Creating orchestrator...');
  const orchestrator = new Orchestrator(services);

  // Hardcoded test issue for now
  const repoUrl = 'https://github.com/xucian/cv-xcoin-hunter';
  const issueNumber = 3;

  console.log(`[Debug] Starting competition for ${repoUrl}#${issueNumber}`);

  try {
    const result = await orchestrator.startCompetition(repoUrl, issueNumber);
    console.log('[Debug] Competition completed!');
    console.log('[Debug] Winner:', result.winner);
    console.log('[Debug] Status:', result.status);
    process.exit(0);
  } catch (error) {
    console.error('[Debug] Competition failed:', error);
    process.exit(1);
  }
}
