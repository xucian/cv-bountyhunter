'use client';

import { cn, truncate, formatRelativeTime } from '@/lib/utils';
import type { Competition } from '@/lib/services';
import { CheckCircle, Clock, Loader2, Trophy } from 'lucide-react';

interface HistoryListProps {
  competitions: Competition[];
  onSelect?: (competition: Competition) => void;
  loading?: boolean;
}

export function HistoryList({ competitions, onSelect, loading }: HistoryListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (competitions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No competitions yet. Start one above!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {competitions.map((comp) => {
        const winner = comp.agents.find((a) => a.id === comp.winner);

        return (
          <button
            key={comp.id}
            onClick={() => onSelect?.(comp)}
            className={cn(
              'w-full text-left p-3 rounded-md border border-border hover:border-muted-foreground transition-colors',
              comp.status === 'completed' ? 'hover:bg-muted/50' : 'bg-primary/5'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Status icon */}
                {comp.status === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Clock className="w-5 h-5 text-primary animate-pulse" />
                )}

                {/* Issue info */}
                <div>
                  <span className="text-green-500 font-mono text-sm">#{comp.issue.number}</span>
                  <span className="ml-2">{truncate(comp.issue.title, 40)}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                {/* Bounty */}
                <span className="text-green-500 font-semibold">
                  ${comp.bountyAmount.toFixed(2)}
                </span>

                {/* Winner */}
                {winner && (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <Trophy className="w-4 h-4" />
                    {winner.name}
                  </span>
                )}

                {/* Time */}
                <span className="text-muted-foreground">
                  {formatRelativeTime(comp.createdAt)}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default HistoryList;
