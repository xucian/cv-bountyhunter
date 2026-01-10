import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { nanoid } from 'nanoid';
import { MainMenu } from './components/MainMenu.js';
import { CompetitionView } from './components/CompetitionView.js';
import { ResultsView } from './components/ResultsView.js';
import { useCompetition } from './hooks/useCompetition.js';
import { config } from '../config.js';
import type { Competition, Issue } from '../types/index.js';

type ViewState = 'menu' | 'competition' | 'results';

export function App() {
  const [currentView, setCurrentView] = useState<ViewState>('menu');
  const { competition, setCompetition, updateAgent, setWinner, setStatus } = useCompetition();

  // Handle starting a new competition
  const handleStartCompetition = useCallback(
    async (repoUrl: string, issueNumber: number, bountyAmount: number) => {
      // Create a mock issue for now (in production, this would fetch from GitHub)
      const issue: Issue = {
        number: issueNumber,
        title: `Issue #${issueNumber} from ${repoUrl}`,
        body: 'Issue description would be fetched from GitHub',
        repoUrl,
        labels: [],
      };

      // Initialize competition with all agents in idle state
      const newCompetition: Competition = {
        id: nanoid(),
        issue,
        bountyAmount,
        status: 'pending',
        agents: config.agents.map((agentConfig) => ({
          id: agentConfig.id,
          name: agentConfig.name,
          status: 'idle',
        })),
        createdAt: Date.now(),
      };

      setCompetition(newCompetition);
      setCurrentView('competition');

      // Simulate competition flow (in production, orchestrator handles this)
      simulateCompetition(newCompetition);
    },
    [setCompetition]
  );

  // Simulate the competition flow for demo purposes
  const simulateCompetition = useCallback(
    async (comp: Competition) => {
      // Start competition
      await delay(500);
      setStatus('running');

      // Start all agents with slight delays
      for (const agent of comp.agents) {
        await delay(200);
        updateAgent(agent.id, {
          status: 'solving',
          startedAt: Date.now(),
        });
      }

      // Simulate agents finishing at different times
      const finishTimes = [
        { id: 'qwen', delay: 2000 + Math.random() * 1000 },
        { id: 'llama', delay: 3000 + Math.random() * 1500 },
        { id: 'deepseek', delay: 2500 + Math.random() * 1000 },
      ];

      // Sort by delay to process in order
      finishTimes.sort((a, b) => a.delay - b.delay);

      let winnerId: string | null = null;

      for (const finish of finishTimes) {
        await delay(finish.delay - (finishTimes[0]?.delay ?? 0));
        const success = Math.random() > 0.2; // 80% success rate

        updateAgent(finish.id, {
          status: success ? 'done' : 'failed',
          completedAt: Date.now(),
          solution: success
            ? {
                agentId: finish.id,
                code: '// Solution code would be here',
                timeMs: finish.delay,
                success: true,
              }
            : undefined,
        });

        // First successful agent is the winner
        if (success && !winnerId) {
          winnerId = finish.id;
        }
      }

      // Judge and determine winner
      await delay(500);
      setStatus('judging');

      await delay(1000);
      if (winnerId) {
        setWinner(winnerId);
      } else {
        setStatus('completed');
      }
    },
    [updateAgent, setStatus, setWinner]
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

  return (
    <Box flexDirection="column" minHeight={20}>
      {currentView === 'menu' && (
        <MainMenu onStartCompetition={handleStartCompetition} />
      )}

      {currentView === 'competition' && competition && (
        <CompetitionView competition={competition} />
      )}

      {currentView === 'results' && competition && (
        <ResultsView
          competition={competition}
          onNewCompetition={handleNewCompetition}
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

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default App;
