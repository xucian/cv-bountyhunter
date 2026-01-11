'use client';

import { useEffect, useState } from 'react';
import { cn, formatTime } from '@/lib/utils';
import type { AgentStatus } from '@/lib/services';
import { Loader2, Check, X, Clock, Trophy } from 'lucide-react';

interface AgentCardProps {
  agent: AgentStatus;
  isWinner?: boolean;
  streamingCode?: string;
}

export function AgentCard({ agent, isWinner, streamingCode }: AgentCardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time while solving
  useEffect(() => {
    if (agent.status !== 'solving' || !agent.startedAt) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - agent.startedAt!);
    }, 100);

    return () => clearInterval(interval);
  }, [agent.status, agent.startedAt]);

  // Calculate displayed time
  const displayTime = agent.solution
    ? formatTime(agent.solution.timeMs)
    : agent.status === 'solving'
    ? formatTime(elapsedTime)
    : '--';

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all duration-300',
        agent.status === 'idle' && 'border-border bg-card',
        agent.status === 'solving' && 'border-primary bg-primary/5 animate-solving',
        agent.status === 'done' && 'border-green-500/50 bg-green-500/5',
        agent.status === 'failed' && 'border-red-500/50 bg-red-500/5',
        isWinner && 'ring-2 ring-yellow-500 border-yellow-500'
      )}
    >
      {/* Winner badge */}
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-yellow-500 text-yellow-950 text-xs font-bold rounded-full flex items-center gap-1">
          <Trophy className="w-3 h-3" />
          WINNER
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">{agent.name}</h3>
        <StatusBadge status={agent.status} />
      </div>

      {/* Time */}
      <div className="flex items-center gap-2 text-muted-foreground mb-3">
        <Clock className="w-4 h-4" />
        <span className="font-mono text-sm">{displayTime}</span>
      </div>

      {/* Solution preview - show streaming or final */}
      {(agent.solution || streamingCode) && (
        <div className="mt-3">
          <div className="text-xs text-muted-foreground mb-1">
            {agent.status === 'solving' ? 'Generating...' : 'Solution:'}
          </div>
          <pre className="text-xs bg-muted/50 rounded p-2 overflow-hidden max-h-32 text-muted-foreground font-mono">
            {agent.solution?.code || streamingCode || ''}
            {agent.status === 'solving' && <span className="animate-pulse">|</span>}
          </pre>
        </div>
      )}

      {/* Status indicator */}
      <div className="absolute bottom-2 right-2">
        {agent.status === 'solving' && (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        )}
        {agent.status === 'done' && (
          <Check className="w-5 h-5 text-green-500" />
        )}
        {agent.status === 'failed' && (
          <X className="w-5 h-5 text-red-500" />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentStatus['status'] }) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium',
        status === 'idle' && 'bg-muted text-muted-foreground',
        status === 'solving' && 'bg-primary/20 text-primary',
        status === 'done' && 'bg-green-500/20 text-green-500',
        status === 'failed' && 'bg-red-500/20 text-red-500'
      )}
    >
      {status.toUpperCase()}
    </span>
  );
}

export default AgentCard;
