import type { ILLMService } from '../../types/services.js';
import type { LLMProvider } from '../../types/index.js';
import { config } from '../../config.js';

const SYSTEM_PROMPT = `You are an expert software engineer. Your task is to fix the issue described by the user.

Provide a clear, working code solution. Include:
1. The fix itself
2. Brief explanation of what was wrong
3. Any relevant code changes

Format your response as code that can be directly applied.`;

/**
 * Multi-provider LLM Service
 * Supports: Fireworks, OpenAI, Anthropic, Google, xAI
 */
export class RealLLMService implements ILLMService {
  async generateSolution(prompt: string, model: string, provider: LLMProvider = 'fireworks'): Promise<string> {
    console.log(`[LLM] Calling ${provider} with model: ${model}`);
    const startTime = Date.now();

    let result: string;

    switch (provider) {
      case 'fireworks':
        result = await this.callFireworks(prompt, model);
        break;
      case 'openai':
        result = await this.callOpenAI(prompt, model);
        break;
      case 'anthropic':
        result = await this.callAnthropic(prompt, model);
        break;
      case 'google':
        result = await this.callGoogle(prompt, model);
        break;
      case 'xai':
        result = await this.callXAI(prompt, model);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[LLM] Response received in ${elapsed}ms`);

    return result;
  }

  private async callFireworks(prompt: string, model: string): Promise<string> {
    const apiKey = config.fireworks.apiKey;
    if (!apiKey) throw new Error('FIREWORKS_API_KEY not set');

    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fireworks API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || '';
  }

  private async callOpenAI(prompt: string, model: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || '';
  }

  private async callAnthropic(prompt: string, model: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content[0]?.text || '';
  }

  private async callGoogle(prompt: string, model: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY not set');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] },
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    return data.candidates[0]?.content?.parts[0]?.text || '';
  }

  private async callXAI(prompt: string, model: string): Promise<string> {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) throw new Error('XAI_API_KEY not set');

    // xAI uses OpenAI-compatible API
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`xAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || '';
  }
}
