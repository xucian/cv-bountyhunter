import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, mkdir, access, unlink } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';
import type { IGitHubService } from '../../types/services.js';
import type { Issue, Solution } from '../../types/index.js';

const execAsync = promisify(exec);

const CONFIG_DIR = join(homedir(), '.codebounty');
const RECENT_REPOS_FILE = join(CONFIG_DIR, 'recent-repos.json');
const REPOS_DIR = join(CONFIG_DIR, 'repos');

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
   * Ensure a repository is cloned locally.
   * - Uses gh repo fork --clone to clone (and fork if needed)
   * - Stores clones in ~/.codebounty/repos/{owner}-{repo}-{hash}/
   * - Returns the local path to the cloned repository
   */
  private async ensureRepoCloned(repoUrl: string): Promise<string> {
    const repo = this.extractRepoPath(repoUrl);

    // Create unique directory name: owner-repo-{8-char-hash}
    const hash = createHash('sha256').update(repoUrl).digest('hex').slice(0, 8);
    const dirName = `${repo.replace('/', '-')}-${hash}`;
    const localPath = join(REPOS_DIR, dirName);

    // Check if already cloned
    try {
      await access(localPath);
      console.log(`[GitHub] Repository already cloned at: ${localPath}`);

      // Fetch latest changes
      console.log(`[GitHub] Fetching latest changes...`);
      await execAsync('git fetch --all', { cwd: localPath });

      return localPath;
    } catch {
      // Directory doesn't exist, need to clone
    }

    console.log(`[GitHub] Cloning repository: ${repo}`);
    await mkdir(REPOS_DIR, { recursive: true });

    try {
      // Try to check if we have write access
      let needsFork = false;
      try {
        const { stdout } = await execAsync(`gh repo view ${repo} --json viewerPermission -q .viewerPermission`);
        const permission = stdout.trim();
        needsFork = !['ADMIN', 'WRITE', 'MAINTAIN'].includes(permission);
        console.log(`[GitHub] Repository permission: ${permission} (needs fork: ${needsFork})`);
      } catch {
        // If we can't check permissions, assume we need to fork
        needsFork = true;
        console.log(`[GitHub] Could not check permissions, assuming fork is needed`);
      }

      if (needsFork) {
        // Get our username to construct the fork name
        const { stdout: username } = await execAsync('gh api user -q .login');
        const forkRepo = `${username.trim()}/${repo.split('/')[1]}`;

        // Check if fork already exists
        let forkExists = false;
        try {
          await execAsync(`gh repo view ${forkRepo} --json name`);
          forkExists = true;
          console.log(`[GitHub] Fork already exists: ${forkRepo}`);
        } catch {
          // Fork doesn't exist, need to create it
        }

        if (!forkExists) {
          // Create fork
          console.log(`[GitHub] Creating fork of ${repo}...`);
          await execAsync(`gh repo fork ${repo} --clone=false`);
          console.log(`[GitHub] ✓ Fork created: ${forkRepo}`);
        }

        // Clone the fork using HTTPS URL directly
        console.log(`[GitHub] Cloning fork to: ${localPath}`);
        const forkUrl = `https://github.com/${forkRepo}.git`;
        await execAsync(`git clone "${forkUrl}" "${localPath}"`);

        // Configure git to use gh auth helper
        await execAsync('git config credential.helper ""', { cwd: localPath });
        await execAsync('git config --add credential.helper "!gh auth git-credential"', { cwd: localPath });

        // Add upstream remote if it doesn't exist
        try {
          await execAsync(`git remote add upstream https://github.com/${repo}.git`, { cwd: localPath });
        } catch {
          // Remote already exists, that's fine
        }

        console.log(`[GitHub] ✓ Fork ready at ${localPath}`);
      } else {
        // Direct clone using HTTPS URL
        console.log(`[GitHub] Cloning directly to: ${localPath}`);
        const repoUrl = `https://github.com/${repo}.git`;
        await execAsync(`git clone "${repoUrl}" "${localPath}"`);

        // Configure git to use gh auth helper
        await execAsync('git config credential.helper ""', { cwd: localPath });
        await execAsync('git config --add credential.helper "!gh auth git-credential"', { cwd: localPath });
      }

      console.log(`[GitHub] ✓ Repository ready at: ${localPath}`);
      return localPath;
    } catch (error) {
      console.error(`[GitHub] Failed to clone repository:`, error);
      throw new Error(`Failed to clone repository ${repo}: ${error}`);
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
      // Ensure repository is cloned locally
      console.log(`[GitHub] Preparing to create PR for issue #${issue.number}`);
      const localPath = await this.ensureRepoCloned(issue.repoUrl);

      // Get current branch to return to later
      const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: localPath });
      const originalBranch = currentBranch.trim();

      console.log(`[GitHub] Current branch: ${originalBranch}`);

      // Fetch latest changes
      console.log(`[GitHub] Fetching latest changes from remote...`);
      await execAsync('git fetch --all', { cwd: localPath });

      // Get the actual default branch from remote
      let defaultBranch = 'main';
      try {
        const { stdout: remoteHead } = await execAsync('git symbolic-ref refs/remotes/origin/HEAD', { cwd: localPath });
        defaultBranch = remoteHead.trim().replace('refs/remotes/origin/', '');
        console.log(`[GitHub] Detected default branch from remote: ${defaultBranch}`);
      } catch {
        // If symbolic-ref fails, try to detect manually
        console.log(`[GitHub] Could not detect default branch from symbolic-ref, checking manually...`);
        try {
          await execAsync('git rev-parse --verify origin/main', { cwd: localPath });
          defaultBranch = 'main';
        } catch {
          try {
            await execAsync('git rev-parse --verify origin/master', { cwd: localPath });
            defaultBranch = 'master';
          } catch {
            // Try using gh CLI to get default branch
            try {
              const { stdout: ghBranch } = await execAsync(`gh repo view ${repo} --json defaultBranchRef -q .defaultBranchRef.name`);
              defaultBranch = ghBranch.trim();
              console.log(`[GitHub] Got default branch from gh CLI: ${defaultBranch}`);
            } catch {
              console.warn(`[GitHub] WARNING: Could not determine default branch, assuming 'main'`);
              defaultBranch = 'main';
            }
          }
        }
      }

      console.log(`[GitHub] Using default branch: ${defaultBranch}`);

      // Check if branch already exists (from previous attempt)
      try {
        await execAsync(`git rev-parse --verify ${branchName}`, { cwd: localPath });
        console.log(`[GitHub] Branch ${branchName} already exists, deleting it...`);

        // Switch to default branch first
        try {
          await execAsync(`git checkout ${defaultBranch}`, { cwd: localPath });
        } catch {
          // If local branch doesn't exist, create it from remote
          await execAsync(`git checkout -b ${defaultBranch} origin/${defaultBranch}`, { cwd: localPath });
        }

        await execAsync(`git branch -D ${branchName}`, { cwd: localPath });
      } catch {
        // Branch doesn't exist, that's fine
      }

      // Create new branch from latest default branch
      console.log(`[GitHub] Creating branch ${branchName} from origin/${defaultBranch}...`);
      await execAsync(`git checkout -b ${branchName} origin/${defaultBranch}`, { cwd: localPath });

      let solutionFile: string;
      let solutionContent: string;
      let solutionFilePath: string; // Absolute path for file operations

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
        solutionFilePath = join(localPath, solutionFile);
        const dir = solutionFile.includes('/') ? solutionFile.substring(0, solutionFile.lastIndexOf('/')) : null;
        if (dir) {
          await mkdir(join(localPath, dir), { recursive: true });
        }
      } else {
        // Full mode: Create markdown file with metadata
        solutionFile = `solutions/issue-${issue.number}-solution.md`;
        solutionFilePath = join(localPath, solutionFile);
        await mkdir(join(localPath, 'solutions'), { recursive: true });

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

      console.log(`[GitHub] Writing solution to: ${solutionFile}`);
      await writeFile(solutionFilePath, solutionContent);

      // Stage, commit, and push
      console.log(`[GitHub] Staging changes...`);
      await execAsync(`git add "${solutionFile}"`, { cwd: localPath });

      console.log(`[GitHub] Creating commit...`);
      const commitMsg = `Fix issue #${issue.number}: ${this.escapeShell(issue.title.slice(0, 50))}`;
      await execAsync(`git commit -m "${commitMsg}"`, { cwd: localPath });

      console.log(`[GitHub] Pushing branch to remote...`);
      await execAsync(`git push -u origin ${branchName}`, { cwd: localPath });

      // Create PR with professional formatting
      const prTitle = codeOnly
        ? `Fix: ${issue.title}`
        : `Resolve issue #${issue.number}: ${issue.title}`;

      let prBody: string;

      if (codeOnly) {
        // Professional code-only PR body
        prBody = `## Description

This PR addresses issue #${issue.number}.

${issue.body ? `### Issue Details\n\n${issue.body.slice(0, 500)}${issue.body.length > 500 ? '...' : ''}\n\n` : ''}### Changes

${solution.code.length > 500 ? 'See the changed files for the complete implementation.' : '```\n' + solution.code + '\n```'}

---

Closes #${issue.number}`;
      } else {
        // Professional full-mode PR body
        const timeInSeconds = (solution.timeMs / 1000).toFixed(2);
        prBody = `## Overview

This pull request resolves issue #${issue.number} with an automated solution generated by the CodeBounty AI agent system.

## Problem Statement

${issue.body || issue.title}

## Proposed Solution

The solution has been generated and is available in \`${solutionFile}\`. Please review the implementation details in the file.

## Implementation Details

- **Processing Agent**: ${agentName}
- **Processing Time**: ${timeInSeconds}s
- **Solution Approach**: AI-generated automated fix

## Review Notes

Please carefully review the proposed changes before merging. While this solution was generated automatically, human review is recommended to ensure it meets your project's standards and requirements.

---

Closes #${issue.number}

<sub>Generated by [CodeBounty](https://github.com/yourusername/codebounty) - AI-powered issue resolution platform</sub>`;
      }

      console.log(`[GitHub] Creating pull request...`);

      // Write PR body to temp file to preserve formatting
      const tempBodyFile = join(tmpdir(), `pr-body-${randomBytes(8).toString('hex')}.md`);
      await writeFile(tempBodyFile, prBody, 'utf-8');

      try {
        const { stdout: prUrl } = await execAsync(
          `gh pr create --title "${this.escapeShell(prTitle)}" --body-file "${tempBodyFile}"`,
          { cwd: localPath }
        );

        console.log(`[GitHub] ✓ Pull request created: ${prUrl.trim()}`);

        // Clean up temp file
        await unlink(tempBodyFile).catch(() => {/* ignore cleanup errors */});

        // Return to original branch
        console.log(`[GitHub] Returning to branch: ${originalBranch}`);
        await execAsync(`git checkout ${originalBranch}`, { cwd: localPath });

        return prUrl.trim();
      } catch (error) {
        // Clean up temp file on error
        await unlink(tempBodyFile).catch(() => {/* ignore cleanup errors */});
        throw error;
      }
    } catch (error) {
      console.error('[GitHub] Failed to create solution PR:', error);
      throw new Error(`Failed to create PR for issue #${issue.number}: ${error}`);
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
