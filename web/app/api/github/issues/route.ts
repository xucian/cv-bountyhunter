import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Issue } from '@/lib/services';

const execAsync = promisify(exec);

/**
 * Parse GitHub repo URL to owner/repo format
 */
function parseRepoUrl(url: string): string | null {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com[\/:]([^\/]+\/[^\/\.]+)/,  // https://github.com/owner/repo or git@github.com:owner/repo
    /^([^\/]+\/[^\/]+)$/,                   // owner/repo
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1].replace(/\.git$/, '');
    }
  }
  return null;
}

/**
 * GET /api/github/issues?repo=owner/repo
 * List open issues from a GitHub repository
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoUrl = searchParams.get('repo');

  if (!repoUrl) {
    return NextResponse.json(
      { error: 'repo query parameter is required' },
      { status: 400 }
    );
  }

  const repo = parseRepoUrl(repoUrl);
  if (!repo) {
    return NextResponse.json(
      { error: 'Invalid repository URL format' },
      { status: 400 }
    );
  }

  try {
    // Use gh CLI to list issues
    const { stdout } = await execAsync(
      `gh issue list --repo ${repo} --state open --limit 20 --json number,title,body,labels`
    );

    const rawIssues = JSON.parse(stdout) as Array<{
      number: number;
      title: string;
      body: string;
      labels: Array<{ name: string }>;
    }>;

    const issues: Issue[] = rawIssues.map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      repoUrl: `https://github.com/${repo}`,
      labels: issue.labels.map((l) => l.name),
    }));

    return NextResponse.json(issues);
  } catch (error) {
    console.error('[API] Failed to list issues:', error);

    // Check if gh is not authenticated
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    if (errorMsg.includes('gh auth login')) {
      return NextResponse.json(
        { error: 'GitHub CLI not authenticated. Run: gh auth login' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to list issues. Make sure gh CLI is installed and authenticated.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/github/issues
 * Create a new issue
 *
 * Body: { repo: string, title: string, body: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repo: repoUrl, title, body: issueBody } = body as {
      repo: string;
      title: string;
      body: string;
    };

    if (!repoUrl || !title) {
      return NextResponse.json(
        { error: 'repo and title are required' },
        { status: 400 }
      );
    }

    const repo = parseRepoUrl(repoUrl);
    if (!repo) {
      return NextResponse.json(
        { error: 'Invalid repository URL format' },
        { status: 400 }
      );
    }

    // Create issue using gh CLI
    const { stdout } = await execAsync(
      `gh issue create --repo ${repo} --title "${title.replace(/"/g, '\\"')}" --body "${(issueBody || 'Created via CodeBounty').replace(/"/g, '\\"')}" --json number,title,body,labels`
    );

    const rawIssue = JSON.parse(stdout) as {
      number: number;
      title: string;
      body: string;
      labels: Array<{ name: string }>;
    };

    const issue: Issue = {
      number: rawIssue.number,
      title: rawIssue.title,
      body: rawIssue.body || '',
      repoUrl: `https://github.com/${repo}`,
      labels: rawIssue.labels?.map((l) => l.name) || [],
    };

    return NextResponse.json(issue);
  } catch (error) {
    console.error('[API] Failed to create issue:', error);
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    );
  }
}
