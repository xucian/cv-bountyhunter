import type { ILLMService } from '../../types/services.js';

export class MockLLMService implements ILLMService {
  async generateSolution(prompt: string, model: string): Promise<string> {
    console.log(`[MockLLM] Generating solution with model: ${model}`);
    console.log(`[MockLLM] Prompt length: ${prompt.length} chars`);

    // Wait 2-5 seconds to simulate LLM thinking
    const thinkTime = 2000 + Math.random() * 3000;
    await this.delay(thinkTime);

    console.log(`[MockLLM] Generated solution in ${Math.round(thinkTime)}ms`);

    // Return a realistic-looking code fix
    return `// Fix for authentication bug
// Model: ${model}

export function sanitizePassword(password: string): string {
  // FIXED: Don't strip special characters from passwords
  // Special characters are valid and should be preserved

  // Only trim whitespace from beginning and end
  return password.trim();
}

export function validateCredentials(email: string, password: string): boolean {
  // Validate email format
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (!emailRegex.test(email)) {
    return false;
  }

  // Password should be at least 8 characters
  // Special characters are now properly supported
  if (password.length < 8) {
    return false;
  }

  return true;
}

// Tests
console.assert(sanitizePassword('p@ss!word#123') === 'p@ss!word#123');
console.assert(validateCredentials('test@example.com', 'p@ss!word#123') === true);
`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
