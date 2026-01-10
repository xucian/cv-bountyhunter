import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { nanoid } from 'nanoid';
import { MainMenu } from './components/MainMenu.js';
import { CompetitionView } from './components/CompetitionView.js';
import { ResultsView } from './components/ResultsView.js';
import { useCompetition } from './hooks/useCompetition.js';
import { createServices } from '../services/index.js';
import { config } from '../config.js';
import type { Competition, Issue, Solution } from '../types/index.js';

type ViewState = 'menu' | 'competition' | 'results';

export function App() {
  const [currentView, setCurrentView] = useState<ViewState>('menu');
  const { competition, setCompetition, updateAgent, setWinner, setStatus } = useCompetition();

  // Initialize services once
  const services = useMemo(() => createServices(), []);

  // Handle starting a new competition with an Issue
  const handleStartCompetition = useCallback(
    async (issue: Issue) => {
      // Calculate bounty from labels
      const bountyAmount = calculateBounty(issue);

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

      // Run the competition
      runCompetition(newCompetition);
    },
    [setCompetition]
  );

  // Run the actual competition using services
  const runCompetition = useCallback(
    async (comp: Competition) => {
      // Start competition
      await delay(300);
      setStatus('running');

      // Start all agents
      for (const agent of comp.agents) {
        updateAgent(agent.id, {
          status: 'solving',
          startedAt: Date.now(),
        });
      }

      // Run all agents in parallel using the LLM service
      const agentPromises = config.agents.map(async (agentConfig) => {
        const startTime = Date.now();

        try {
          // Build prompt from issue
          const prompt = `Fix this GitHub issue:

Title: ${comp.issue.title}

Description:
${comp.issue.body}

Provide a complete code solution to fix this issue.`;

          // Call LLM service
          const code = await services.llm.generateSolution(prompt, agentConfig.model);

          const solution: Solution = {
            agentId: agentConfig.id,
            code,
            timeMs: Date.now() - startTime,
            success: true,
          };

          updateAgent(agentConfig.id, {
            status: 'done',
            completedAt: Date.now(),
            solution,
          });

          return solution;
        } catch (error) {
          console.error(`Agent ${agentConfig.id} failed:`, error);

          updateAgent(agentConfig.id, {
            status: 'failed',
            completedAt: Date.now(),
          });

          return null;
        }
      });

      // Wait for all agents
      const results = await Promise.all(agentPromises);

      // Judge phase
      await delay(300);
      setStatus('judging');

      // Use reviewer service to pick winner
      const successfulSolutions = results.filter((r): r is Solution => r !== null && r.success);

      if (successfulSolutions.length > 0) {
        const reviewResult = await services.reviewer.reviewSolutions(comp.issue, successfulSolutions);

        await delay(500);

        if (reviewResult.winnerId) {
          setWinner(reviewResult.winnerId);
        } else {
          setStatus('completed');
        }
      } else {
        await delay(500);
        setStatus('completed');
      }
    },
    [services, updateAgent, setStatus, setWinner]
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
        <MainMenu
          githubService={services.github}
          onStartCompetition={handleStartCompetition}
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

// Calculate bounty based on issue labels
function calculateBounty(issue: Issue): number {
  const labels = issue.labels.map((l) => l.toLowerCase());

  if (labels.includes('bounty-high') || labels.includes('high-priority')) {
    return 50;
  }
  if (labels.includes('bounty-medium') || labels.includes('enhancement')) {
    return 25;
  }
  if (labels.includes('bug')) {
    return 15;
  }
  return 10;
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default App;
