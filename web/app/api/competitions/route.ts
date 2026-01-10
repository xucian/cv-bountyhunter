import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { listCompetitions, saveCompetition } from '@/lib/db';
import { agents, type Competition, type Issue } from '@/lib/services';

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
 * Start a new competition
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

    // Calculate bounty (random $0.01-$0.05 for testnet)
    const amount = bountyAmount ?? Math.round((0.01 + Math.random() * 0.04) * 100) / 100;

    // Create competition
    const competition: Competition = {
      id: nanoid(),
      issue,
      bountyAmount: amount,
      status: 'pending',
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: 'idle' as const,
      })),
      createdAt: Date.now(),
    };

    // Save to MongoDB
    await saveCompetition(competition);

    // Note: The actual competition running is handled by a separate process
    // The web UI will subscribe to WebSocket for updates
    // We could trigger the competition runner here, but for hackathon
    // we'll keep it simple - just create and return

    return NextResponse.json({
      competitionId: competition.id,
      competition,
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000',
    });
  } catch (error) {
    console.error('[API] Failed to create competition:', error);
    return NextResponse.json(
      { error: 'Failed to create competition' },
      { status: 500 }
    );
  }
}
