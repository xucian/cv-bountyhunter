import type { IReviewerService } from '../../types/services.js';
import type { Issue, Solution, ReviewResult, ReviewScore } from '../../types/index.js';
import { config } from '../../config.js';
import { log } from '../../utils/logger.js';

/**
 * Real Reviewer Service using LLM for code review
 * Uses Fireworks AI to evaluate and compare solutions
 *
 * NOTE: Solutions are shuffled before presenting to LLM to avoid position bias
 */
export class RealReviewerService implements IReviewerService {
  private apiKey: string;
  private model = 'accounts/fireworks/models/llama-v3p3-70b-instruct';

  constructor() {
    this.apiKey = config.fireworks.apiKey;
    if (!this.apiKey) {
      log('warn', 'RealReviewer', 'Warning: FIREWORKS_API_KEY not set');
    }
  }

  async reviewSolutions(issue: Issue, solutions: Solution[]): Promise<ReviewResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      throw new Error('FIREWORKS_API_KEY environment variable is required');
    }

    // Filter to only successful solutions
    const successfulSolutions = solutions.filter(s => s.success && s.code);

    if (successfulSolutions.length === 0) {
      return {
        winnerId: null,
        scores: solutions.map(s => ({
          agentId: s.agentId,
          score: 0,
          correctness: 0,
          codeQuality: 0,
          completeness: 0,
          reasoning: 'Solution failed or produced no code.',
        })),
        summary: 'No successful solutions were submitted.',
        reviewTimeMs: Date.now() - startTime,
      };
    }

    log('info', 'Reviewer', `Evaluating ${successfulSolutions.length} solutions...`);

    // IMPORTANT: Shuffle solutions to avoid LLM position bias
    const shuffledSolutions = this.shuffleArray([...successfulSolutions]);
    log('info', 'Reviewer', `Shuffled order: ${shuffledSolutions.map(s => s.agentId).join(', ')}`);

    // Build the review prompt with shuffled solutions
    const prompt = this.buildReviewPrompt(issue, shuffledSolutions);

    try {
      const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are an expert code reviewer. Evaluate solutions to GitHub issues and return your assessment in JSON format.

IMPORTANT: Evaluate each solution OBJECTIVELY based on its merits. Do NOT let the order solutions are presented influence your judgment. The best solution wins regardless of position.

You must respond with ONLY valid JSON in this exact format:
{
  "scores": [
    {
      "agentId": "agent_id_here",
      "score": 85,
      "correctness": 90,
      "codeQuality": 80,
      "completeness": 85,
      "reasoning": "Brief explanation of the evaluation"
    }
  ],
  "winnerId": "agent_id_of_winner",
  "summary": "Brief overall summary comparing the solutions"
}

Score each criterion from 0-100:
- correctness: Does it fix the issue correctly? (50% weight)
- codeQuality: Is the code clean, readable, following best practices? (30% weight)
- completeness: Does it handle edge cases and provide a complete solution? (20% weight)
- score: Weighted average of the above

Use the EXACT agentId strings provided (e.g., "llama", "qwen", "deepseek"). The winnerId MUST match one of these exactly.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 2048,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fireworks API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices[0]?.message?.content || '';
      log('info', 'Reviewer', 'Got LLM response, parsing...');
      log('debug', 'Reviewer', `Raw response: ${content.slice(0, 500)}...`);

      // Parse the JSON response
      const result = this.parseReviewResponse(content, solutions, startTime);
      log('info', 'Reviewer', `Winner: ${result.winnerId}`);
      log('info', 'Reviewer', `Scores: ${result.scores.map(s => `${s.agentId}=${s.score}`).join(', ')}`);

      return result;

    } catch (error) {
      log('error', 'Reviewer', `LLM review failed: ${error}`);
      // Fallback to simple scoring based on solution time
      return this.fallbackReview(solutions, startTime);
    }
  }

  /**
   * Fisher-Yates shuffle to randomize solution order
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private buildReviewPrompt(issue: Issue, solutions: Solution[]): string {
    let prompt = `## GitHub Issue to Fix

**Title:** ${issue.title}

**Description:**
${issue.body}

---

## Solutions to Evaluate

`;

    for (const solution of solutions) {
      prompt += `### Solution by ${solution.agentId}
**Time to complete:** ${solution.timeMs}ms

\`\`\`
${solution.code.slice(0, 3000)}${solution.code.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`

---

`;
    }

    prompt += `
Please evaluate each solution and determine the winner. Return your assessment as JSON.`;

    return prompt;
  }

  private parseReviewResponse(content: string, solutions: Solution[], startTime: number): ReviewResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response
      const scores: ReviewScore[] = solutions.map(solution => {
        const found = parsed.scores?.find((s: any) => s.agentId === solution.agentId);
        if (found) {
          return {
            agentId: solution.agentId,
            score: Math.min(100, Math.max(0, Number(found.score) || 0)),
            correctness: Math.min(100, Math.max(0, Number(found.correctness) || 0)),
            codeQuality: Math.min(100, Math.max(0, Number(found.codeQuality) || 0)),
            completeness: Math.min(100, Math.max(0, Number(found.completeness) || 0)),
            reasoning: String(found.reasoning || 'No reasoning provided'),
          };
        }
        return {
          agentId: solution.agentId,
          score: 0,
          correctness: 0,
          codeQuality: 0,
          completeness: 0,
          reasoning: 'Not evaluated',
        };
      });

      return {
        winnerId: parsed.winnerId || scores.sort((a, b) => b.score - a.score)[0]?.agentId || null,
        scores,
        summary: parsed.summary || 'Review completed.',
        reviewTimeMs: Date.now() - startTime,
      };

    } catch (parseError) {
      log('error', 'Reviewer', `Failed to parse response: ${parseError}`);
      log('error', 'Reviewer', `Raw content: ${content.slice(0, 500)}`);
      throw parseError;
    }
  }

  private fallbackReview(solutions: Solution[], startTime: number): ReviewResult {
    log('warn', 'Reviewer', 'Using fallback scoring (fastest solution wins)');

    const successfulSolutions = solutions.filter(s => s.success);
    if (successfulSolutions.length === 0) {
      return {
        winnerId: null,
        scores: solutions.map(s => ({
          agentId: s.agentId,
          score: 0,
          correctness: 0,
          codeQuality: 0,
          completeness: 0,
          reasoning: 'Fallback: No successful solutions',
        })),
        summary: 'Review failed, no successful solutions.',
        reviewTimeMs: Date.now() - startTime,
      };
    }

    // Sort by time (fastest wins)
    const sorted = [...successfulSolutions].sort((a, b) => a.timeMs - b.timeMs);
    const winner = sorted[0];

    const scores: ReviewScore[] = solutions.map((s, i) => ({
      agentId: s.agentId,
      score: s.success ? 80 - (i * 10) : 0,
      correctness: s.success ? 80 : 0,
      codeQuality: s.success ? 75 : 0,
      completeness: s.success ? 70 : 0,
      reasoning: s.success
        ? `Fallback scoring: Ranked #${sorted.findIndex(x => x.agentId === s.agentId) + 1} by completion time`
        : 'Solution failed',
    }));

    return {
      winnerId: winner.agentId,
      scores,
      summary: `Fallback review: ${winner.agentId} won with fastest completion time (${winner.timeMs}ms)`,
      reviewTimeMs: Date.now() - startTime,
    };
  }
}
