import type { IAgentClient } from '../../types/services.js';
import type { Solution, SolveTask } from '../../types/index.js';

export class MockAgentClient implements IAgentClient {
  // 80% success rate
  private readonly successRate = 0.8;

  async callAgent(agentUrl: string, task: SolveTask): Promise<Solution> {
    const startTime = Date.now();

    console.log(`[MockAgentClient] Calling agent at ${agentUrl}`);
    console.log(`[MockAgentClient] Task: Solve issue #${task.issue.number}`);
    console.log(`[MockAgentClient] Agent ID: ${task.agentId}`);

    // Wait 3-8 seconds to simulate agent work
    const workTime = 3000 + Math.random() * 5000;
    await this.delay(workTime);

    const timeMs = Date.now() - startTime;
    const success = Math.random() < this.successRate;

    console.log(`[MockAgentClient] Agent ${task.agentId} finished in ${timeMs}ms`);
    console.log(`[MockAgentClient] Success: ${success}`);

    if (success) {
      return {
        agentId: task.agentId,
        code: this.generateFakeCode(task),
        timeMs,
        success: true,
      };
    } else {
      return {
        agentId: task.agentId,
        code: '',
        timeMs,
        success: false,
      };
    }
  }

  private generateFakeCode(task: SolveTask): string {
    const templates = [
      this.generateFixTemplate1(task),
      this.generateFixTemplate2(task),
      this.generateFixTemplate3(task),
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generateFixTemplate1(task: SolveTask): string {
    return `// Solution by Agent: ${task.agentId}
// Issue: ${task.issue.title}
// Generated at: ${new Date().toISOString()}

/**
 * Fixed the authentication bug by properly handling special characters.
 * The original implementation was incorrectly sanitizing passwords.
 */

export function sanitizeInput(input: string): string {
  // Preserve special characters - they are valid for passwords
  return input.trim();
}

export function authenticate(email: string, password: string): Promise<boolean> {
  const sanitizedEmail = sanitizeInput(email).toLowerCase();
  const sanitizedPassword = sanitizeInput(password);

  // Proper validation without stripping special chars
  return validateCredentials(sanitizedEmail, sanitizedPassword);
}
`;
  }

  private generateFixTemplate2(task: SolveTask): string {
    return `// Agent: ${task.agentId}
// Fixing: ${task.issue.title}

import { hash, compare } from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  // Do NOT sanitize - special characters are valid
  return hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  // Direct comparison without sanitization
  return compare(password, hashedPassword);
}

// Unit tests
describe('Password handling', () => {
  it('should handle special characters', async () => {
    const password = 'p@ss!word#123';
    const hashed = await hashPassword(password);
    expect(await verifyPassword(password, hashed)).toBe(true);
  });
});
`;
  }

  private generateFixTemplate3(task: SolveTask): string {
    return `// Solution for Issue #${task.issue.number}
// Agent: ${task.agentId}

class AuthService {
  private passwordRegex = /^.{8,}$/; // Min 8 chars, allow all characters

  validatePassword(password: string): boolean {
    // FIXED: No longer strips special characters
    // Special chars like @, !, #, $ are now allowed
    return this.passwordRegex.test(password);
  }

  async login(email: string, password: string): Promise<{ token: string }> {
    if (!this.validatePassword(password)) {
      throw new Error('Password must be at least 8 characters');
    }

    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await this.comparePasswords(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    return { token: this.generateToken(user.id) };
  }
}

export default new AuthService();
`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
