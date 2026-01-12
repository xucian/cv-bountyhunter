/**
 * API endpoint to get payments for a specific agent
 * GET /api/agents/[id]/payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPaymentsByAgent, getAgentPaymentStats } from '@/lib/db';
import { agents } from '@/lib/services';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Find agent info
    const agent = agents.find(a => a.id === id);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Get payments and stats
    const [payments, stats] = await Promise.all([
      getPaymentsByAgent(id),
      getAgentPaymentStats(id),
    ]);
    
    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        walletAddress: agent.walletAddress,
      },
      payments,
      stats,
    });
  } catch (error) {
    console.error('[API] Error fetching agent payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent payments' },
      { status: 500 }
    );
  }
}
