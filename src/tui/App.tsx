import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { MainMenu } from './components/MainMenu.js';
import { CompetitionView } from './components/CompetitionView.js';
import { ResultsView } from './components/ResultsView.js';
import { HistoryView } from './components/HistoryView.js';
import { Leaderboard } from './components/Leaderboard.js';
import { useCompetition } from './hooks/useCompetition.js';
import { createServices } from '../services/index.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import type { Competition, Issue } from '../types/index.js';

type ViewState = 'menu' | 'competition' | 'results' | 'history' | 'leaderboard';

export function App() {
  const [currentView, setCurrentView] = useState<ViewState>('menu');
  const { competition, setCompetition } = useCompetition();
  const [competitionId, setCompetitionId] = useState<string | null>(null);

  // Initialize services and orchestrator once
  const services = useMemo(() => createServices(), []);
  const orchestrator = useMemo(() => new Orchestrator(services), [services]);

  // Poll MongoDB for competition updates
  useEffect(() => {
    if (!competitionId) return;

    const pollInterval = setInterval(async () => {
      try {
        const updated = await services.state.getCompetition(competitionId);
        if (updated) {
          setCompetition(updated);
        }
      } catch (err) {
        console.error('[TUI] Failed to poll competition:', err);
      }
    }, 500); // Poll every 500ms

    return () => clearInterval(pollInterval);
  }, [competitionId, services.state, setCompetition]);

  // Handle starting a new competition with an Issue
  const handleStartCompetition = useCallback(
    async (issue: Issue) => {
      console.log('[TUI] ========================================');
      console.log('[TUI] handleStartCompetition INVOKED');
      console.log('[TUI] Issue:', issue.repoUrl, '#', issue.number);
      console.log('[TUI] ========================================');
      try {
        console.log('[TUI] Setting view to competition...');
        setCurrentView('competition');
        console.log('[TUI] Starting competition via Orchestrator...');

        // Call orchestrator which handles:
        // 1. RAG indexing
        // 2. Agent execution
        // 3. Review
        // 4. Payment
        const completedCompetition = await orchestrator.startCompetition(
          issue.repoUrl,
          issue.number
        );

        console.log('[TUI] Competition completed:', completedCompetition.id);
        setCompetitionId(completedCompetition.id);
        setCompetition(completedCompetition);
      } catch (err) {
        console.error('[TUI] Competition failed:', err);
        console.error('[TUI] Error details:', err instanceof Error ? err.message : String(err));
        console.error('[TUI] Stack trace:', err instanceof Error ? err.stack : 'N/A');

        // Set an error state so TUI can show it
        // For now, just log and stay on current view
      }
    },
    [orchestrator, setCompetition]
  );

  // Handle transitioning from competition to results
  useInput(
    (input, key) => {
      if (currentView === 'competition' && competition?.status === 'completed') {
        setCurrentView('results');
      }
    },
    { isActive: currentView === 'competition' }
  );

  // Handle starting new competition from results
  const handleNewCompetition = useCallback(() => {
    setCompetition(null);
    setCurrentView('menu');
  }, [setCompetition]);

  // Handle viewing history
  const handleViewHistory = useCallback(() => {
    setCurrentView('history');
  }, []);

  // Handle viewing leaderboard
  const handleViewLeaderboard = useCallback(() => {
    setCurrentView('leaderboard');
  }, []);

  // Handle going back to menu
  const handleBackToMenu = useCallback(() => {
    setCurrentView('menu');
  }, []);

  // Handle selecting a competition from history
  const handleSelectHistoryCompetition = useCallback((comp: Competition) => {
    setCompetition(comp);
    setCurrentView('results');
  }, [setCompetition]);

  return (
    <Box flexDirection="column" minHeight={20}>
      {currentView === 'menu' && (
        <MainMenu
          githubService={services.github}
          onStartCompetition={handleStartCompetition}
          onViewHistory={handleViewHistory}
          onViewLeaderboard={handleViewLeaderboard}
        />
      )}

      {currentView === 'competition' && competition && (
        <CompetitionView competition={competition} />
      )}

      {currentView === 'results' && competition && (
        <ResultsView
          competition={competition}
          githubService={services.github}
          onNewCompetition={handleNewCompetition}
        />
      )}

      {currentView === 'history' && (
        <HistoryView
          stateService={services.state}
          onBack={handleBackToMenu}
          onSelectCompetition={handleSelectHistoryCompetition}
        />
      )}

      {currentView === 'leaderboard' && (
        <Leaderboard
          stateService={services.state}
          onBack={handleBackToMenu}
        />
      )}

      {/* Footer */}
      <Box
        justifyContent="center"
        marginTop={1}
        borderStyle="single"
        borderColor="gray"
        paddingX={2}
      >
        <Text dimColor>
          CodeBounty - AI Agents Competing with X402 Payments
        </Text>
      </Box>
    </Box>
  );
}

export default App;
