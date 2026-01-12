'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Competition } from '@/lib/services';
import { agents } from '@/lib/services';
import { Trophy, TrendingUp, DollarSign, Target } from 'lucide-react';

interface LeaderboardProps {
  competitions: Competition[];
}

interface AgentStats {
  id: string;
  name: string;
  wins: number;
  losses: number;
  totalEarnings: number;
  avgScore: number;
  competitions: number;
}

export function Leaderboard({ competitions }: LeaderboardProps) {
  const stats = useMemo(() => {
    // Initialize stats for all agents
    const agentStats: Record<string, AgentStats> = {};
    for (const agent of agents) {
      agentStats[agent.id] = {
        id: agent.id,
        name: agent.name,
        wins: 0,
        losses: 0,
        totalEarnings: 0,
        avgScore: 0,
        competitions: 0,
      };
    }

    // Calculate stats from completed competitions
    const completed = competitions.filter((c) => c.status === 'completed');

    for (const comp of completed) {
      const winnerId = comp.winner;

      for (const agent of comp.agents) {
        if (!agentStats[agent.id]) continue;

        agentStats[agent.id].competitions++;

        if (agent.id === winnerId) {
          agentStats[agent.id].wins++;
          agentStats[agent.id].totalEarnings += comp.bountyAmount;
        } else if (agent.status === 'done') {
          agentStats[agent.id].losses++;
        }

        // Calculate average score from review results
        if (comp.reviewResult?.scores) {
          const score = comp.reviewResult.scores.find((s) => s.agentId === agent.id);
          if (score) {
            const currentAvg = agentStats[agent.id].avgScore;
            const count = agentStats[agent.id].competitions;
            agentStats[agent.id].avgScore =
              (currentAvg * (count - 1) + score.score) / count;
          }
        }
      }
    }

    // Sort by wins, then by earnings
    return Object.values(agentStats).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.totalEarnings - a.totalEarnings;
    });
  }, [competitions]);

  const totalPaid = stats.reduce((sum, s) => sum + s.totalEarnings, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-center gap-8 py-2">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">
            {competitions.filter((c) => c.status === 'completed').length}
          </div>
          <div className="text-xs text-muted-foreground">Competitions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">
            ${totalPaid.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">Total Paid</div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 gap-2 p-3 bg-muted/50 text-sm font-medium text-muted-foreground">
          <div>#</div>
          <div className="col-span-2">Agent</div>
          <div className="text-center">W/L</div>
          <div className="text-center">Win %</div>
          <div className="text-right">Earnings</div>
          <div className="text-right">Avg Score</div>
        </div>

        {/* Rows */}
        {stats.map((agent, index) => {
          const winRate = agent.competitions > 0
            ? Math.round((agent.wins / agent.competitions) * 100)
            : 0;

          return (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className={cn(
                'grid grid-cols-7 gap-2 p-3 items-center border-t border-border cursor-pointer transition-colors hover:bg-muted/50',
                index === 0 && 'bg-yellow-500/5 hover:bg-yellow-500/10'
              )}
            >
              {/* Rank */}
              <div className={cn(
                'font-bold',
                index === 0 && 'text-yellow-500',
                index === 1 && 'text-gray-400',
                index === 2 && 'text-orange-400'
              )}>
                {index === 0 ? (
                  <Trophy className="w-5 h-5" />
                ) : (
                  `#${index + 1}`
                )}
              </div>

              {/* Agent Name */}
              <div className="col-span-2 font-medium">
                {agent.name}
              </div>

              {/* Win/Loss */}
              <div className="text-center">
                <span className="text-green-500">{agent.wins}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-red-500">{agent.losses}</span>
              </div>

              {/* Win Rate */}
              <div className="text-center">
                <span className={cn(
                  winRate >= 50 ? 'text-green-500' : 'text-muted-foreground'
                )}>
                  {winRate}%
                </span>
              </div>

              {/* Earnings */}
              <div className="text-right text-green-500 font-mono">
                ${agent.totalEarnings.toFixed(2)}
              </div>

              {/* Avg Score */}
              <div className="text-right font-mono text-muted-foreground">
                {agent.avgScore.toFixed(1)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default Leaderboard;
