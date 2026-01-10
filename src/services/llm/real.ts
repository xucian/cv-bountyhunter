import type { ILLMService } from '../../types/services.js';
import { config } from '../../config.js';

/**
 * Real LLM Service using Fireworks AI
 */
export class RealLLMService implements ILLMService {
  private apiKey: string;

  constructor() {
    this.apiKey = config.fireworks.apiKey;
    if (!this.apiKey) {
      console.warn('[RealLLMService] Warning: FIREWORKS_API_KEY not set');
    }
  }

  async generateSolution(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('FIREWORKS_API_KEY environment variable is required');
    }

    console.log(`[LLM] Calling Fireworks AI with model: ${model}`);
    const startTime = Date.now();

    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an expert software engineer. Your task is to fix the issue described by the user.

Provide a clear, working code solution. Include:
1. The fix itself
2. Brief explanation of what was wrong
3. Any relevant code changes

Format your response as code that can be directly applied.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fireworks API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { total_tokens: number };
    };

    const elapsed = Date.now() - startTime;
    console.log(`[LLM] Response received in ${elapsed}ms (tokens: ${data.usage?.total_tokens ?? 'unknown'})`);

    return data.choices[0]?.message?.content || '';
  }
}
