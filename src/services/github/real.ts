import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import type { IGitHubService } from '../../types/services.js';
import type { Issue, Solution } from '../../types/index.js';

const execAsync = promisify(exec);

const CONFIG_DIR = join(homedir(), '.codebounty');
const RECENT_REPOS_FILE = join(CONFIG_DIR, 'recent-repos.json');

export class RealGitHubService implements IGitHubService {
  /**
   * Check if user is authenticated with gh CLI
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await execAsync('gh auth status');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect current repo from git remote
   */
  async getCurrentRepo(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git remote get-url origin');
      const remoteUrl = stdout.trim();

      // Convert SSH to HTTPS URL if needed
      // git@github.com:owner/repo.git -> https://github.com/owner/repo
      if (remoteUrl.startsWith('git@github.com:')) {
        const path = remoteUrl.replace('git@github.com:', '').replace('.git', '');
        return `https://github.com/${path}`;
      }

      // Already HTTPS
      if (remoteUrl.startsWith('https://github.com/')) {
        return remoteUrl.replace('.git', '');
      }

      return remoteUrl;
    } catch {
      return null;
    }
  }

  /**
   * Get recently used repos from local storage
   */
  async getRecentRepos(): Promise<string[]> {
    try {
      const data = await readFile(RECENT_REPOS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Add repo to recent repos list
   */
  async addRecentRepo(repoUrl: string): Promise<void> {
    try {
      await mkdir(CONFIG_DIR, { recursive: true });

      const recent = await this.getRecentRepos();
      const updated = [
        repoUrl,
        ...recent.filter(r => r !== repoUrl),
      ].slice(0, 10);

      await writeFile(RECENT_REPOS_FILE, JSON.stringify(updated, null, 2));
    } catch (error) {
      console.error('Failed to save recent repos:', error);
    }
  }

  /**
   * List open issues for a repo
   */
  async listIssues(repoUrl: string, limit = 10): Promise<Issue[]> {
    const repo = this.extractRepoPath(repoUrl);

    try {
      const { stdout } = await execAsync(
        `gh issue list --repo ${repo} --state open --limit ${limit} --json number,title,body,labels`
      );

      const issues = JSON.parse(stdout);

      return issues.map((issue: any) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        repoUrl,
        labels: issue.labels?.map((l: any) => l.name) || [],
      }));
    } catch (error) {
      console.error('Failed to list issues:', error);
      return [];
    }
  }

  /**
   * Get a specific issue by number
   */
  async getIssue(repoUrl: string, issueNumber: number): Promise<Issue> {
    const repo = this.extractRepoPath(repoUrl);

    const { stdout } = await execAsync(
      `gh issue view ${issueNumber} --repo ${repo} --json number,title,body,labels`
    );

    const issue = JSON.parse(stdout);

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      repoUrl,
      labels: issue.labels?.map((l: any) => l.name) || [],
    };
  }

  /**
   * Create a new issue
   */
  async createIssue(
    repoUrl: string,
    title: string,
    body: string,
    _labels: string[] = []
  ): Promise<Issue> {
    const repo = this.extractRepoPath(repoUrl);

    // Use heredoc style to avoid escaping issues
    const cmd = `gh issue create --repo ${repo} --title "${this.escapeShell(title)}" --body "${this.escapeShell(body)}"`;

    try {
      const { stdout } = await execAsync(cmd);

      // gh issue create returns the issue URL
      const issueUrl = stdout.trim();
      const issueNumber = parseInt(issueUrl.split('/').pop() || '0', 10);

      return {
        number: issueNumber,
        title,
        body,
        repoUrl,
        labels: [],
      };
    } catch (error) {
      console.error('Failed to create issue:', error);
      throw new Error(`Failed to create issue in ${repo}`);
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(_repo: string, branchName: string): Promise<void> {
    await execAsync(`git checkout -b ${branchName}`);
  }

  /**
   * Create a pull request
   */
  async createPR(
    repo: string,
    branch: string,
    title: string,
    body: string
  ): Promise<string> {
    // Push branch first
    await execAsync(`git push -u origin ${branch}`);

    // Create PR
    const { stdout } = await execAsync(
      `gh pr create --repo ${repo} --title "${this.escapeShell(title)}" --body "${this.escapeShell(body)}"`
    );

    return stdout.trim();
  }

  /**
   * Create a PR with the solution code
   * @param codeOnly - If true, only include raw code without commentary/metadata
   */
  async createSolutionPR(
    issue: Issue,
    solution: Solution,
    agentName: string,
    codeOnly = false
  ): Promise<string> {
    const repo = this.extractRepoPath(issue.repoUrl);
    const branchName = `codebounty/fix-issue-${issue.number}`;

    try {
      // Get current branch to return to later
      const { stdout: currentBranch } = await execAsync('git branch --show-current');
      const originalBranch = currentBranch.trim();

      // Fetch latest and create branch from main/master
      await execAsync('git fetch origin');

      // Try to create branch from origin/main or origin/master
      try {
        await execAsync(`git checkout -b ${branchName} origin/main`);
      } catch {
        await execAsync(`git checkout -b ${branchName} origin/master`);
      }

      let solutionFile: string;
      let solutionContent: string;

      if (codeOnly) {
        // Code-only mode: Try to extract file path from solution or use a sensible default
        const fileMatch = solution.code.match(/\/\/\s*File:\s*(.+)|\/\*\s*File:\s*(.+?)\s*\*\/|#\s*File:\s*(.+)/i);
        const extractedPath = fileMatch?.[1] || fileMatch?.[2] || fileMatch?.[3];

        if (extractedPath) {
          // Use extracted file path
          solutionFile = extractedPath.trim();
        } else {
          // Default to a code file based on detected language
          const ext = this.detectExtension(solution.code);
          solutionFile = `src/fix-issue-${issue.number}${ext}`;
        }

        // Strip any metadata comments from the code
        solutionContent = this.stripMetadataComments(solution.code);

        // Ensure parent directory exists
        const dir = solutionFile.includes('/') ? solutionFile.substring(0, solutionFile.lastIndexOf('/')) : null;
        if (dir) {
          await mkdir(dir, { recursive: true });
        }
      } else {
        // Full mode: Create markdown file with metadata
        solutionFile = `solutions/issue-${issue.number}-solution.md`;
        await mkdir('solutions', { recursive: true });

        solutionContent = `# Solution for Issue #${issue.number}

## Issue: ${issue.title}

${issue.body}

---

## Solution by ${agentName}

**Completed in:** ${solution.timeMs}ms

\`\`\`
${solution.code}
\`\`\`

---

*Generated by Bounty Hunter - AI Agents Competing with X402 Payments*
`;
      }

      await writeFile(solutionFile, solutionContent);

      // Stage, commit, and push
      await execAsync(`git add ${solutionFile}`);
      await execAsync(`git commit -m "Fix issue #${issue.number}: ${this.escapeShell(issue.title.slice(0, 50))}"`);
      await execAsync(`git push -u origin ${branchName}`);

      // Create PR
      const prTitle = `Fix #${issue.number}: ${issue.title}`;
      let prBody: string;

      if (codeOnly) {
        prBody = `Fixes #${issue.number}

${solution.code.length > 500 ? 'See the changed files for the implementation.' : '```\n' + solution.code + '\n```'}`;
      } else {
        prBody = `## Summary
Automated fix for issue #${issue.number} generated by **${agentName}** via Bounty Hunter.

## Solution
See \`${solutionFile}\` for the proposed fix.

## Details
- **Agent:** ${agentName}
- **Time to solve:** ${solution.timeMs}ms
- **Issue:** #${issue.number}

---
*Created by [Bounty Hunter](https://github.com) - AI Agents Competing with X402 Payments*`;
      }

      const { stdout: prUrl } = await execAsync(
        `gh pr create --repo ${repo} --title "${this.escapeShell(prTitle)}" --body "${this.escapeShell(prBody)}"`
      );

      // Return to original branch
      await execAsync(`git checkout ${originalBranch}`);

      return prUrl.trim();
    } catch (error) {
      console.error('Failed to create solution PR:', error);
      throw new Error(`Failed to create PR for issue #${issue.number}`);
    }
  }

  /**
   * Detect file extension based on code content
   */
  private detectExtension(code: string): string {
    if (code.includes('import React') || code.includes('from "react"') || code.includes("from 'react'")) {
      return '.tsx';
    }
    if (code.includes(': string') || code.includes(': number') || code.includes('interface ') || code.includes('type ')) {
      return '.ts';
    }
    if (code.includes('def ') || code.includes('import ') && code.includes(':') && !code.includes(';')) {
      return '.py';
    }
    if (code.includes('func ') || code.includes('package ')) {
      return '.go';
    }
    if (code.includes('fn ') || code.includes('let mut ')) {
      return '.rs';
    }
    return '.ts'; // Default to TypeScript
  }

  /**
   * Strip metadata/commentary comments from the beginning of code
   */
  private stripMetadataComments(code: string): string {
    const lines = code.split('\n');
    let startIndex = 0;

    // Skip leading comments that look like metadata
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        line.startsWith('//') ||
        line.startsWith('/*') ||
        line.startsWith('*') ||
        line.startsWith('#') ||
        line === ''
      ) {
        // Check if this looks like metadata vs actual code comment
        if (
          line.toLowerCase().includes('file:') ||
          line.toLowerCase().includes('solution') ||
          line.toLowerCase().includes('generated') ||
          line.toLowerCase().includes('agent') ||
          line === ''
        ) {
          startIndex = i + 1;
        } else {
          break; // Stop at first non-metadata comment
        }
      } else {
        break;
      }
    }

    return lines.slice(startIndex).join('\n').trim();
  }

  /**
   * Extract owner/repo from GitHub URL
   */
  private extractRepoPath(repoUrl: string): string {
    // https://github.com/owner/repo -> owner/repo
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    return match ? match[1].replace('.git', '') : repoUrl;
  }

  /**
   * Escape string for shell commands
   */
  private escapeShell(str: string): string {
    // Escape backslashes, double quotes, backticks, dollar signs, and newlines
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\n/g, '\\n');
  }
}
