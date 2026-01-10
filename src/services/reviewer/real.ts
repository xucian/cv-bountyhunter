import type { IReviewerService } from '../../types/services.js';
import type { Issue, Solution, ReviewResult } from '../../types/index.js';

/**
 * Real Reviewer Service using LLM for code review
 * Uses Fireworks AI to evaluate and compare solutions
 */
export class RealReviewerService implements IReviewerService {
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required for RealReviewerService');
    }
  }

  async reviewSolutions(_issue: Issue, _solutions: Solution[]): Promise<ReviewResult> {
    // TODO: Implement real LLM-based code review
    // This would:
    // 1. Format all solutions into a comparison prompt
    // 2. Ask the LLM to evaluate each solution on correctness, quality, completeness
    // 3. Parse the LLM response into ReviewResult format
    throw new Error('RealReviewerService not implemented. Set MOCK_REVIEWER=true');
  }
}
