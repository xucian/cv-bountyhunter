import type { IGitHubService } from '../../types/services.js';
import type { Issue } from '../../types/index.js';

export class MockGitHubService implements IGitHubService {
  private recentRepos: string[] = [
    'https://github.com/anthropics/claude-code',
    'https://github.com/vercel/next.js',
  ];

  private mockIssues: Issue[] = [
    {
      number: 1,
      title: 'Fix authentication bug in login flow',
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
Error message: "Invalid credentials" even with correct password.`,
      repoUrl: '',
      labels: ['bug', 'priority:high'],
    },
    {
      number: 2,
      title: 'Add dark mode support',
      body: `## Feature Request
Users have requested dark mode support for the application.

## Requirements
- Toggle in settings
- Persist preference
- System preference detection`,
      repoUrl: '',
      labels: ['enhancement', 'ui'],
    },
    {
      number: 3,
      title: 'Improve API response time',
      body: `## Performance Issue
The /api/users endpoint is slow when fetching large datasets.

## Current: 2.5s average
## Target: < 500ms`,
      repoUrl: '',
      labels: ['performance', 'api'],
    },
  ];

  async isAuthenticated(): Promise<boolean> {
    console.log('[MockGitHub] Checking authentication...');
    return true;
  }

  async getCurrentRepo(): Promise<string | null> {
    console.log('[MockGitHub] Detecting current repo...');
    await this.delay(100);
    // Simulate detecting current repo
    return 'https://github.com/user/codebounty';
  }

  async getRecentRepos(): Promise<string[]> {
    console.log('[MockGitHub] Getting recent repos...');
    return this.recentRepos;
  }

  async addRecentRepo(repoUrl: string): Promise<void> {
    console.log(`[MockGitHub] Adding to recent repos: ${repoUrl}`);
    // Add to front, remove duplicates, keep max 10
    this.recentRepos = [
      repoUrl,
      ...this.recentRepos.filter(r => r !== repoUrl),
    ].slice(0, 10);
  }

  async listIssues(repoUrl: string, limit = 10): Promise<Issue[]> {
    console.log(`[MockGitHub] Listing issues for ${repoUrl} (limit: ${limit})`);
    await this.delay(300);
    return this.mockIssues.slice(0, limit).map(issue => ({
      ...issue,
      repoUrl,
    }));
  }

  async getIssue(repoUrl: string, issueNumber: number): Promise<Issue> {
    console.log(`[MockGitHub] Fetching issue #${issueNumber} from ${repoUrl}`);
    await this.delay(200);

    const issue = this.mockIssues.find(i => i.number === issueNumber);
    if (issue) {
      return { ...issue, repoUrl };
    }

    return {
      number: issueNumber,
      title: `Issue #${issueNumber}`,
      body: 'Mock issue body',
      repoUrl,
      labels: ['bug'],
    };
  }

  async createIssue(
    repoUrl: string,
    title: string,
    body: string,
    labels: string[] = []
  ): Promise<Issue> {
    console.log(`[MockGitHub] Creating issue: "${title}"`);
    await this.delay(400);

    const newIssue: Issue = {
      number: this.mockIssues.length + 1,
      title,
      body,
      repoUrl,
      labels,
    };

    this.mockIssues.push(newIssue);
    return newIssue;
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
    await this.delay(500);

    const prNumber = Math.floor(Math.random() * 1000) + 100;
    return `https://github.com/${repo}/pull/${prNumber}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
