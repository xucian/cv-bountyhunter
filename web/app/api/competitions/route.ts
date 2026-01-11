import { NextRequest, NextResponse } from 'next/server';
import { listCompetitions } from '@/lib/db';
import type { Issue } from '@/lib/services';

/**
 * GET /api/competitions
 * List all competitions
 */
export async function GET(request: NextRequest) {
  try {
    const competitions = await listCompetitions(50);
    return NextResponse.json(competitions);
  } catch (error) {
    console.error('[API] Failed to list competitions:', error);
    return NextResponse.json(
      { error: 'Failed to list competitions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/competitions
 * Start a new competition by calling the WS server
 *
 * Body: { issue: Issue, bountyAmount?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { issue, bountyAmount } = body as {
      issue: Issue;
      bountyAmount?: number;
    };

    if (!issue || !issue.title || !issue.repoUrl) {
      return NextResponse.json(
        { error: 'Issue with title and repoUrl is required' },
        { status: 400 }
      );
    }

    // Call the WS server to create and run the competition
    const wsServerUrl = process.env.WS_SERVER_URL || 'http://localhost:4000';
    const response = await fetch(`${wsServerUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue, bountyAmount }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start competition');
    }

    const result = await response.json();

    return NextResponse.json({
      competitionId: result.competitionId,
      competition: result.competition,
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000',
    });
  } catch (error) {
    console.error('[API] Failed to create competition:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create competition' },
      { status: 500 }
    );
  }
}
