'use client';

import { useState, useEffect, useCallback } from 'react';
import { IssueSelector } from '@/components/IssueSelector';
import { CompetitionPanel } from '@/components/CompetitionPanel';
import { HistoryList } from '@/components/HistoryList';
import { Leaderboard } from '@/components/Leaderboard';
import { useCompetitionSocket } from '@/hooks/useCompetitionSocket';
import type { Competition, Issue } from '@/lib/services';
import { ChevronDown, ChevronUp, Zap, Github, Trophy, History } from 'lucide-react';

export default function Home() {
  // State
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [activeCompetition, setActiveCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Collapsible sections
  const [historyOpen, setHistoryOpen] = useState(true);
  const [leaderboardOpen, setLeaderboardOpen] = useState(true);

  // WebSocket connection for active competition
  const { competition: liveCompetition, connected } = useCompetitionSocket({
    competitionId: activeCompetition?.id || '',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000',
  });

  // Load competitions on mount
  useEffect(() => {
    loadCompetitions();
  }, []);

  // Update active competition from WebSocket
  useEffect(() => {
    if (liveCompetition && activeCompetition) {
      setActiveCompetition(liveCompetition);

      // Update in list too
      setCompetitions((prev) =>
        prev.map((c) => (c.id === liveCompetition.id ? liveCompetition : c))
      );
    }
  }, [liveCompetition]);

  const loadCompetitions = async () => {
    try {
      const res = await fetch('/api/competitions');
      const data = await res.json();
      setCompetitions(data);

      // If there's a running competition, set it as active
      const running = data.find(
        (c: Competition) => c.status !== 'completed'
      );
      if (running) {
        setActiveCompetition(running);
      }
    } catch (error) {
      console.error('Failed to load competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCompetition = async (issue: Issue) => {
    setStarting(true);

    try {
      const res = await fetch('/api/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start competition');
      }

      // Set as active competition
      setActiveCompetition(data.competition);

      // Add to list
      setCompetitions((prev) => [data.competition, ...prev]);
    } catch (error) {
      console.error('Failed to start competition:', error);
      alert('Failed to start competition: ' + (error as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const handleSelectCompetition = (competition: Competition) => {
    setActiveCompetition(competition);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">CodeBounty</h1>
                <p className="text-sm text-muted-foreground">
                  AI Agents Compete for USDC Bounties
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded">
                X402 Protocol
              </span>
              <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                Base Sepolia
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Active Competition or New Competition */}
        <section className="border border-border rounded-lg p-6">
          {activeCompetition ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Active Competition
                </h2>
                {activeCompetition.status === 'completed' && (
                  <button
                    onClick={() => setActiveCompetition(null)}
                    className="text-sm text-primary hover:underline"
                  >
                    Start New Competition
                  </button>
                )}
              </div>
              <CompetitionPanel
                competition={activeCompetition}
                connected={connected}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Github className="w-5 h-5" />
                Start New Competition
              </h2>
              <IssueSelector
                onSelectIssue={handleStartCompetition}
                disabled={starting}
              />
            </div>
          )}
        </section>

        {/* History Section */}
        <section className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5" />
              Competition History
              <span className="text-sm font-normal text-muted-foreground">
                ({competitions.length})
              </span>
            </h2>
            {historyOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          {historyOpen && (
            <div className="p-4 pt-0">
              <HistoryList
                competitions={competitions}
                onSelect={handleSelectCompetition}
                loading={loading}
              />
            </div>
          )}
        </section>

        {/* Leaderboard Section */}
        <section className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setLeaderboardOpen(!leaderboardOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Agent Leaderboard
            </h2>
            {leaderboardOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          {leaderboardOpen && (
            <div className="p-4 pt-0">
              <Leaderboard competitions={competitions} />
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          CodeBounty - AI Agents Competing with X402 Payments on Base Sepolia
        </div>
      </footer>
    </div>
  );
}
