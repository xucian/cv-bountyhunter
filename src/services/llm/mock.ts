import type { ILLMService, StreamCallback } from '../../types/services.js';
import type { LLMProvider } from '../../types/index.js';

// Different mock solutions for variety
const MOCK_SOLUTIONS = [
  `// Solution using functional approach
export function sanitizePassword(password: string): string {
  // FIXED: Preserve special characters in passwords
  return password.trim();
}

export function validateCredentials(email: string, password: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (!emailRegex.test(email)) return false;
  if (password.length < 8) return false;
  return true;
}`,
  `// Solution with enhanced validation
function isValidEmail(email: string): boolean {
  return /^[\\w.-]+@[\\w.-]+\\.\\w+$/.test(email);
}

function isStrongPassword(password: string): boolean {
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\\d/.test(password);
  return hasLength && hasUpper && hasLower && hasNumber;
}

export function authenticate(email: string, password: string): boolean {
  return isValidEmail(email) && isStrongPassword(password);
}`,
  `// Object-oriented solution
class PasswordValidator {
  private minLength = 8;

  validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.minLength) {
      errors.push(\`Password must be at least \${this.minLength} characters\`);
    }

    // Special characters are now allowed!
    return { valid: errors.length === 0, errors };
  }
}

export const validator = new PasswordValidator();`,
];

export class MockLLMService implements ILLMService {
  async generateSolution(prompt: string, model: string, provider?: LLMProvider): Promise<string> {
    return this.generateSolutionStreaming(prompt, model, () => {}, provider);
  }

  async generateSolutionStreaming(
    prompt: string,
    model: string,
    onChunk: StreamCallback,
    provider?: LLMProvider
  ): Promise<string> {
    console.log(`[MockLLM] Streaming solution with model: ${model} (provider: ${provider || 'default'})`);

    // Pick a random solution and add model info
    const solutionIndex = Math.floor(Math.random() * MOCK_SOLUTIONS.length);
    const solution = `// Model: ${model}\n${MOCK_SOLUTIONS[solutionIndex]}`;

    // Stream character by character with small delays
    let accumulated = '';
    const chunkSize = 3 + Math.floor(Math.random() * 5); // 3-7 chars at a time

    for (let i = 0; i < solution.length; i += chunkSize) {
      const chunk = solution.slice(i, i + chunkSize);
      accumulated += chunk;
      onChunk(chunk, accumulated);

      // Small delay between chunks (10-30ms)
      await this.delay(10 + Math.random() * 20);
    }

    console.log(`[MockLLM] Finished streaming ${solution.length} chars`);
    return solution;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
