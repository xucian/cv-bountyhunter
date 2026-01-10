import type { IGitHubService } from '../../types/services.js';
import type { Issue } from '../../types/index.js';

export class RealGitHubService implements IGitHubService {
  async isAuthenticated(): Promise<boolean> {
    throw new Error('RealGitHubService.isAuthenticated() not implemented');
  }

  async getIssue(repoUrl: string, issueNumber: number): Promise<Issue> {
    throw new Error('RealGitHubService.getIssue() not implemented');
  }

  async createBranch(repo: string, branchName: string): Promise<void> {
    throw new Error('RealGitHubService.createBranch() not implemented');
  }

  async createPR(
    repo: string,
    branch: string,
    title: string,
    body: string
  ): Promise<string> {
    throw new Error('RealGitHubService.createPR() not implemented');
  }
}
