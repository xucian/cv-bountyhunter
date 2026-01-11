import { NextRequest, NextResponse } from 'next/server';
import { getCompetition } from '@/lib/db';

/**
 * GET /api/competitions/[id]
 * Get a single competition by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const competition = await getCompetition(params.id);

    if (!competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(competition);
  } catch (error) {
    console.error('[API] Failed to get competition:', error);
    return NextResponse.json(
      { error: 'Failed to get competition' },
      { status: 500 }
    );
  }
}
