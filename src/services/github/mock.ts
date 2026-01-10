import type { IGitHubService } from '../../types/services.js';
import type { Issue } from '../../types/index.js';

export class MockGitHubService implements IGitHubService {
  async isAuthenticated(): Promise<boolean> {
    console.log('[MockGitHub] Checking authentication...');
    return true;
  }

  async getIssue(repoUrl: string, issueNumber: number): Promise<Issue> {
    console.log(`[MockGitHub] Fetching issue #${issueNumber} from ${repoUrl}`);

    // Simulate network delay
    await this.delay(300);

    return {
      number: issueNumber,
      title: `Fix authentication bug in login flow`,
      body: `## Description
The login flow fails when users enter special characters in their password.

## Steps to Reproduce
1. Go to /login
2. Enter email: test@example.com
3. Enter password with special chars: p@ss!word#123
4. Click Login

## Expected Behavior
User should be logged in successfully.

## Actual Behavior
Error message: "Invalid credentials" even with correct password.

## Technical Details
- The password sanitization function is stripping special characters
- Located in src/auth/utils.ts`,
      repoUrl,
      labels: ['bug', 'priority:high', 'auth'],
    };
  }

  async createBranch(repo: string, branchName: string): Promise<void> {
    console.log(`[MockGitHub] Creating branch '${branchName}' in ${repo}`);
    await this.delay(200);
  }

  async createPR(
    repo: string,
    branch: string,
    title: string,
    body: string
  ): Promise<string> {
    console.log(`[MockGitHub] Creating PR: "${title}"`);
    console.log(`[MockGitHub] Branch: ${branch}`);
    console.log(`[MockGitHub] Body preview: ${body.slice(0, 100)}...`);

    await this.delay(500);

    const prNumber = Math.floor(Math.random() * 1000) + 100;
    return `https://github.com/${repo}/pull/${prNumber}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
