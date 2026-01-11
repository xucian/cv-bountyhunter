'use client';

import { AgentCard } from './AgentCard';
import { cn } from '@/lib/utils';
import type { Competition } from '@/lib/services';
import { Loader2, Gavel, CreditCard, CheckCircle, AlertCircle, Zap } from 'lucide-react';

// Streaming state type
interface StreamingState {
  agentCode: Record<string, string>;
  judgingThinking: string;
}

interface CompetitionPanelProps {
  competition: Competition;
  connected?: boolean;
  streaming?: StreamingState;
}

export function CompetitionPanel({ competition, connected, streaming }: CompetitionPanelProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">
              #{competition.issue.number} {competition.issue.title}
            </h2>
            <StatusIndicator status={competition.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Bounty: <span className="text-green-500 font-semibold">${competition.bountyAmount} USDC</span>
          </p>
        </div>
        {connected !== undefined && (
          <div className={cn(
            'flex items-center gap-2 text-xs',
            connected ? 'text-green-500' : 'text-red-500'
          )}>
            <span className={cn(
              'w-2 h-2 rounded-full',
              connected ? 'bg-green-500' : 'bg-red-500'
            )} />
            {connected ? 'Live' : 'Disconnected'}
          </div>
        )}
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {competition.agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isWinner={competition.winner === agent.id}
            streamingCode={streaming?.agentCode[agent.id]}
          />
        ))}
      </div>

      {/* Judge Thinking - show during judging */}
      {competition.status === 'judging' && streaming?.judgingThinking && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gavel className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold text-yellow-500">AI Judge Thinking</span>
          </div>
          <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
            {streaming.judgingThinking}
            <span className="animate-pulse">|</span>
          </pre>
        </div>
      )}

      {/* Status Message */}
      {!streaming?.judgingThinking && <StatusMessage competition={competition} />}

      {/* Results */}
      {competition.status === 'completed' && competition.winner && (
        <CompletionDetails competition={competition} />
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: Competition['status'] }) {
  const config = {
    pending: { icon: Loader2, text: 'Pending', className: 'text-muted-foreground', spin: true },
    running: { icon: Zap, text: 'Racing', className: 'text-primary', spin: false },
    judging: { icon: Gavel, text: 'Judging', className: 'text-yellow-500', spin: false },
    paying: { icon: CreditCard, text: 'Paying', className: 'text-cyan-500', spin: false },
    completed: { icon: CheckCircle, text: 'Completed', className: 'text-green-500', spin: false },
  }[status];

  const Icon = config.icon;

  return (
    <span className={cn('flex items-center gap-1 text-sm', config.className)}>
      <Icon className={cn('w-4 h-4', config.spin && 'animate-spin')} />
      {config.text}
    </span>
  );
}

function StatusMessage({ competition }: { competition: Competition }) {
  if (competition.status === 'pending') {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Waiting for competition to start...
      </div>
    );
  }

  if (competition.status === 'running') {
    const solving = competition.agents.filter((a) => a.status === 'solving').length;
    const done = competition.agents.filter((a) => a.status === 'done').length;
    return (
      <div className="text-center py-4">
        <span className="text-primary font-medium">{solving}</span> agents solving,{' '}
        <span className="text-green-500 font-medium">{done}</span> completed
      </div>
    );
  }

  if (competition.status === 'judging') {
    return (
      <div className="text-center py-4 text-yellow-500 flex items-center justify-center gap-2">
        <Gavel className="w-5 h-5" />
        AI judge is evaluating solutions...
      </div>
    );
  }

  if (competition.status === 'paying') {
    return (
      <div className="text-center py-4 text-cyan-500 flex items-center justify-center gap-2">
        <CreditCard className="w-5 h-5" />
        Processing payment via X402...
      </div>
    );
  }

  return null;
}

function CompletionDetails({ competition }: { competition: Competition }) {
  const winner = competition.agents.find((a) => a.id === competition.winner);

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-500" />
        Competition Complete
      </h3>

      {winner && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Winner:</span>
          <span className="font-semibold text-green-500">{winner.name}</span>
        </div>
      )}

      {/* Payment status */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Payment:</span>
        {competition.paymentTxHash ? (
          <a
            href={`https://sepolia.basescan.org/tx/${competition.paymentTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-500 hover:underline font-mono text-sm"
          >
            {competition.paymentTxHash.slice(0, 10)}...{competition.paymentTxHash.slice(-8)}
          </a>
        ) : competition.paymentError ? (
          <span className="text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {competition.paymentError}
          </span>
        ) : (
          <span className="text-muted-foreground">Pending</span>
        )}
      </div>

      {/* Review scores */}
      {competition.reviewResult && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Review Scores</h4>
          <div className="space-y-2">
            {competition.reviewResult.scores
              .sort((a, b) => b.score - a.score)
              .map((score) => (
                <div
                  key={score.agentId}
                  className={cn(
                    'flex items-center justify-between p-2 rounded',
                    score.agentId === competition.winner ? 'bg-green-500/10' : 'bg-muted/50'
                  )}
                >
                  <span className={cn(
                    'font-medium',
                    score.agentId === competition.winner && 'text-green-500'
                  )}>
                    {competition.agents.find((a) => a.id === score.agentId)?.name}
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span>Score: <span className="font-mono">{score.score}</span></span>
                    <span className="text-muted-foreground">
                      C:{score.correctness} Q:{score.codeQuality} P:{score.completeness}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CompetitionPanel;
