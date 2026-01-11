import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/competitions/[id]/pr
 * Create a PR from the winning solution
 *
 * Body: { codeOnly?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { codeOnly = false } = body as { codeOnly?: boolean };

    // Call the WS server to create the PR
    const wsServerUrl = process.env.WS_SERVER_URL || 'http://localhost:4000';
    const response = await fetch(`${wsServerUrl}/competitions/${id}/pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeOnly }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create PR');
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Failed to create PR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create PR' },
      { status: 500 }
    );
  }
}
