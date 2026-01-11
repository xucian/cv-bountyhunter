'use client';

import { useState, useEffect, useRef } from 'react';
import { AgentCard } from './AgentCard';
import { cn } from '@/lib/utils';
import type { Competition } from '@/lib/services';
import {
  Loader2,
  Gavel,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Zap,
  Database,
  Search,
  FileCode,
  Cpu,
  GitPullRequest,
} from 'lucide-react';

// RAG progress state
interface RAGProgress {
  stage: 'scanning' | 'parsing' | 'embedding' | 'querying' | 'complete' | 'idle';
  message: string;
  current?: number;
  total?: number;
  chunksFound?: number;
}

// Streaming state type
interface StreamingState {
  agentCode: Record<string, string>;
  judgingThinking: string;
  ragProgress: RAGProgress;
}

interface CompetitionPanelProps {
  competition: Competition;
  connected?: boolean;
  streaming?: StreamingState;
}

export function CompetitionPanel({ competition, connected, streaming }: CompetitionPanelProps) {
  const ragProgress = streaming?.ragProgress;
  const showRagProgress = ragProgress && ragProgress.stage !== 'idle' && ragProgress.stage !== 'complete';
  const ragComplete = ragProgress?.stage === 'complete';

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

      {/* RAG Progress Panel */}
      {(showRagProgress || ragComplete) && (
        <RAGProgressPanel ragProgress={ragProgress!} />
      )}

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
        <JudgeThinkingPanel thinking={streaming.judgingThinking} />
      )}

      {/* Status Message */}
      {!streaming?.judgingThinking && !showRagProgress && (
        <StatusMessage competition={competition} ragComplete={ragComplete} chunksFound={ragProgress?.chunksFound} />
      )}

      {/* Results */}
      {competition.status === 'completed' && competition.winner && (
        <CompletionDetails competition={competition} />
      )}
    </div>
  );
}

/**
 * RAG Progress Panel - Shows vector indexing/search progress
 */
function RAGProgressPanel({ ragProgress }: { ragProgress: RAGProgress }) {
  const stageIcons = {
    scanning: Search,
    parsing: FileCode,
    embedding: Cpu,
    querying: Database,
    complete: CheckCircle,
    idle: Database,
  };

  const stageColors = {
    scanning: 'text-blue-500 border-blue-500/30 bg-blue-500/5',
    parsing: 'text-purple-500 border-purple-500/30 bg-purple-500/5',
    embedding: 'text-cyan-500 border-cyan-500/30 bg-cyan-500/5',
    querying: 'text-amber-500 border-amber-500/30 bg-amber-500/5',
    complete: 'text-green-500 border-green-500/30 bg-green-500/5',
    idle: 'text-muted-foreground border-border bg-muted/5',
  };

  const Icon = stageIcons[ragProgress.stage];
  const colorClass = stageColors[ragProgress.stage];

  return (
    <div className={cn('border rounded-lg p-4', colorClass)}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {ragProgress.stage === 'complete' ? (
            <Icon className="w-5 h-5" />
          ) : (
            <Loader2 className="w-5 h-5 animate-spin" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium capitalize">
              {ragProgress.stage === 'complete' ? 'Code Analysis Complete' : `${ragProgress.stage}...`}
            </span>
            {ragProgress.current !== undefined && ragProgress.total !== undefined && (
              <span className="text-xs opacity-70">
                ({ragProgress.current}/{ragProgress.total})
              </span>
            )}
          </div>
          <p className="text-sm opacity-80 truncate">{ragProgress.message}</p>
        </div>
        {ragProgress.chunksFound !== undefined && (
          <div className="flex-shrink-0 text-right">
            <span className="text-lg font-bold">{ragProgress.chunksFound}</span>
            <span className="text-xs block opacity-70">chunks found</span>
          </div>
        )}
      </div>

      {/* Progress bar for embedding stage */}
      {ragProgress.stage === 'embedding' && ragProgress.current && ragProgress.total && (
        <div className="mt-3">
          <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-current rounded-full transition-all duration-300"
              style={{ width: `${(ragProgress.current / ragProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Judge Thinking Panel - Shows AI reasoning during judging
 */
function JudgeThinkingPanel({ thinking }: { thinking: string }) {
  // Parse thinking into sections for better display
  const sections = parseJudgeThinking(thinking);

  return (
    <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-yellow-500/20">
        <Gavel className="w-5 h-5 text-yellow-500" />
        <span className="font-semibold text-yellow-500">AI Judge Reasoning</span>
        <Loader2 className="w-4 h-4 text-yellow-500 animate-spin ml-auto" />
      </div>
      <div className="p-4 max-h-80 overflow-y-auto">
        {sections.map((section, i) => (
          <div key={i} className="mb-3 last:mb-0">
            {section.type === 'header' && (
              <div className="text-sm font-semibold text-yellow-400 mb-1">
                {section.content}
              </div>
            )}
            {section.type === 'agent' && (
              <div className="bg-black/20 rounded p-2 text-sm font-mono">
                <div className="text-cyan-400 font-semibold mb-1">{section.agentName}</div>
                <div className="text-muted-foreground whitespace-pre-wrap">{section.content}</div>
              </div>
            )}
            {section.type === 'decision' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded p-2 text-sm">
                <div className="text-green-400 font-semibold">{section.content}</div>
              </div>
            )}
            {section.type === 'text' && (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {section.content}
                <span className="animate-pulse text-yellow-400">|</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Parse judge thinking into structured sections
 */
function parseJudgeThinking(thinking: string): Array<{
  type: 'header' | 'agent' | 'decision' | 'text';
  content: string;
  agentName?: string;
}> {
  const sections: Array<{ type: 'header' | 'agent' | 'decision' | 'text'; content: string; agentName?: string }> = [];
  const lines = thinking.split('\n');
  let currentSection: typeof sections[0] | null = null;

  for (const line of lines) {
    // Check for headers (emoji lines)
    if (line.match(/^[🔍📋🏆]/)) {
      if (currentSection) sections.push(currentSection);

      if (line.includes('DECISION') || line.includes('Winner')) {
        currentSection = { type: 'decision', content: line };
      } else if (line.includes('Analyzing')) {
        currentSection = { type: 'header', content: line };
      } else {
        // Agent section
        const agentMatch = line.match(/📋\s*(\w+):/i);
        if (agentMatch) {
          currentSection = { type: 'agent', content: '', agentName: agentMatch[1] };
        } else {
          currentSection = { type: 'text', content: line };
        }
      }
    } else if (currentSection) {
      // Append to current section
      if (currentSection.content) {
        currentSection.content += '\n' + line;
      } else {
        currentSection.content = line;
      }
    } else {
      // Start new text section
      currentSection = { type: 'text', content: line };
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
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

function StatusMessage({
  competition,
  ragComplete,
  chunksFound,
}: {
  competition: Competition;
  ragComplete?: boolean;
  chunksFound?: number;
}) {
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
        {ragComplete && chunksFound !== undefined && (
          <span className="text-muted-foreground ml-2">
            (using {chunksFound} code chunks for context)
          </span>
        )}
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
  const [creatingPR, setCreatingPR] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [prError, setPrError] = useState<string | null>(null);
  const [codeOnly, setCodeOnly] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const autoClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCreatePR = async () => {
    setCreatingPR(true);
    setPrError(null);

    // Clear auto-click timer if it's running
    if (autoClickTimerRef.current) {
      clearInterval(autoClickTimerRef.current);
      autoClickTimerRef.current = null;
    }

    try {
      const res = await fetch(`/api/competitions/${competition.id}/pr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeOnly }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create PR');
      }

      setPrUrl(data.prUrl);
    } catch (err) {
      setPrError(err instanceof Error ? err.message : 'Failed to create PR');
    } finally {
      setCreatingPR(false);
    }
  };

  // Auto-click PR button after 10 seconds
  useEffect(() => {
    if (!prUrl && !creatingPR) {
      const secsUntilAutoPR = 5;
      setCountdown(secsUntilAutoPR);

      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            handleCreatePR();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      autoClickTimerRef.current = countdownInterval;

      return () => {
        clearInterval(countdownInterval);
      };
    }
  }, [prUrl, creatingPR]);

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

      {/* Review scores with reasoning */}
      {competition.reviewResult && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Review Scores</h4>
          <div className="space-y-2">
            {competition.reviewResult.scores
              .sort((a: any, b: any) => b.score - a.score)
              .map((score: any) => (
                <div
                  key={score.agentId}
                  className={cn(
                    'p-3 rounded',
                    score.agentId === competition.winner ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted/50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      'font-medium',
                      score.agentId === competition.winner && 'text-green-500'
                    )}>
                      {competition.agents.find((a) => a.id === score.agentId)?.name}
                    </span>
                    <span className="font-bold text-lg">
                      {score.score}<span className="text-xs text-muted-foreground">/100</span>
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                    <span>Correctness: <span className="font-mono">{score.correctness}</span></span>
                    <span>Quality: <span className="font-mono">{score.codeQuality}</span></span>
                    <span>Complete: <span className="font-mono">{score.completeness}</span></span>
                  </div>
                  {score.reasoning && (
                    <p className="text-sm text-muted-foreground italic">
                      "{score.reasoning}"
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Create PR Section */}
      {winner && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-3">Create Pull Request</h4>

          {prUrl ? (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm">PR created:</span>
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-500 hover:underline font-mono text-sm"
              >
                {prUrl}
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={codeOnly}
                  onChange={(e) => setCodeOnly(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Code only (no commentary/metadata)</span>
              </label>

              {prError && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {prError}
                </div>
              )}

              <button
                onClick={handleCreatePR}
                disabled={creatingPR}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {creatingPR ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating PR...
                  </>
                ) : (
                  <>
                    <GitPullRequest className="w-4 h-4" />
                    {countdown > 0 ? (
                      <span>Create PR from Solution ({countdown}s)</span>
                    ) : (
                      <span>Create PR from Solution</span>
                    )}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CompetitionPanel;
