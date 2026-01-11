import type { IReviewerService, StreamCallback } from '../../types/services.js';
import type { Issue, Solution, ReviewResult, ReviewScore } from '../../types/index.js';

/**
 * Mock Reviewer Service
 * Simulates an AI code reviewer that evaluates solutions
 */
export class MockReviewerService implements IReviewerService {
  async reviewSolutions(issue: Issue, solutions: Solution[]): Promise<ReviewResult> {
    return this.reviewSolutionsStreaming(issue, solutions, () => {});
  }

  async reviewSolutionsStreaming(
    issue: Issue,
    solutions: Solution[],
    onChunk: StreamCallback
  ): Promise<ReviewResult> {
    const startTime = Date.now();

    // Filter to only successful solutions
    const successfulSolutions = solutions.filter(s => s.success);

    if (successfulSolutions.length === 0) {
      const noSolutionThinking = `Analyzing submissions for "${issue.title}"...\n\nNo successful solutions were submitted. All agents failed to produce working code.\n\nConclusion: No winner can be determined.`;
      await this.streamText(noSolutionThinking, onChunk);

      return {
        winnerId: null,
        scores: solutions.map(s => this.generateScore(s, false)),
        summary: 'No successful solutions were submitted. All agents failed to produce working code.',
        reviewTimeMs: Date.now() - startTime,
      };
    }

    // Score each solution with streaming thinking
    const scores: ReviewScore[] = [];
    let thinkingAccumulated = '';

    // Stream the thinking process
    const intro = `🔍 Analyzing ${successfulSolutions.length} solutions for: "${issue.title}"\n\n`;
    await this.streamText(intro, onChunk);
    thinkingAccumulated += intro;

    for (const solution of solutions) {
      const score = this.generateScore(solution, solution.success);
      scores.push(score);

      const agentThinking = `📋 ${solution.agentId.toUpperCase()}:\n` +
        `   Correctness: ${score.correctness}/100\n` +
        `   Code Quality: ${score.codeQuality}/100\n` +
        `   Completeness: ${score.completeness}/100\n` +
        `   → Overall Score: ${score.score}/100\n` +
        `   ${score.reasoning}\n\n`;

      await this.streamText(agentThinking, (chunk, acc) => {
        thinkingAccumulated += chunk;
        onChunk(chunk, thinkingAccumulated);
      });
    }

    // Sort by score descending
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);
    const winner = sortedScores[0];

    // Stream the decision
    const decision = `🏆 DECISION:\n` +
      `Winner: ${winner.agentId} with score ${winner.score}/100\n` +
      `The winning solution demonstrated superior correctness and code quality.\n`;

    await this.streamText(decision, (chunk, acc) => {
      thinkingAccumulated += chunk;
      onChunk(chunk, thinkingAccumulated);
    });

    // Generate summary
    const summary = this.generateSummary(issue, winner, scores);

    return {
      winnerId: winner.score > 0 ? winner.agentId : null,
      scores,
      summary,
      reviewTimeMs: Date.now() - startTime,
    };
  }

  private async streamText(text: string, onChunk: StreamCallback): Promise<void> {
    let accumulated = '';
    const chunkSize = 2 + Math.floor(Math.random() * 4); // 2-5 chars

    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      accumulated += chunk;
      onChunk(chunk, accumulated);
      await this.delay(15 + Math.random() * 25);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateScore(solution: Solution, isSuccessful: boolean): ReviewScore {
    if (!isSuccessful) {
      return {
        agentId: solution.agentId,
        score: 0,
        correctness: 0,
        codeQuality: 0,
        completeness: 0,
        reasoning: 'Solution failed to compile or produced errors.',
      };
    }

    // Generate random but realistic scores
    const correctness = 70 + Math.floor(Math.random() * 30);
    const codeQuality = 60 + Math.floor(Math.random() * 40);
    const completeness = 65 + Math.floor(Math.random() * 35);

    // Weight the scores
    const score = Math.round(
      correctness * 0.5 + codeQuality * 0.3 + completeness * 0.2
    );

    const reasonings = [
      `The solution correctly addresses the issue with clean, readable code. ${this.getSpeedComment(solution.timeMs)}`,
      `Good implementation that handles the edge cases well. Code follows best practices. ${this.getSpeedComment(solution.timeMs)}`,
      `Solid solution with proper error handling. The code is well-structured and maintainable. ${this.getSpeedComment(solution.timeMs)}`,
      `Effective fix that resolves the issue. Some minor improvements could be made to code organization. ${this.getSpeedComment(solution.timeMs)}`,
    ];

    return {
      agentId: solution.agentId,
      score,
      correctness,
      codeQuality,
      completeness,
      reasoning: reasonings[Math.floor(Math.random() * reasonings.length)],
    };
  }

  private getSpeedComment(timeMs: number): string {
    if (timeMs < 3000) return 'Impressively fast solution time.';
    if (timeMs < 5000) return 'Good solution speed.';
    if (timeMs < 8000) return 'Reasonable completion time.';
    return 'Took longer than expected but delivered quality.';
  }

  private generateSummary(issue: Issue, winner: ReviewScore, allScores: ReviewScore[]): string {
    const successCount = allScores.filter(s => s.score > 0).length;
    const totalCount = allScores.length;

    return `Review complete for "${issue.title}". ` +
      `${successCount}/${totalCount} agents submitted successful solutions. ` +
      `Winner: ${winner.agentId} with a score of ${winner.score}/100. ` +
      `The winning solution demonstrated strong correctness (${winner.correctness}/100) ` +
      `and good code quality (${winner.codeQuality}/100).`;
  }
}
