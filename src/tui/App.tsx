import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { nanoid } from 'nanoid';
import { MainMenu } from './components/MainMenu.js';
import { CompetitionView } from './components/CompetitionView.js';
import { ResultsView } from './components/ResultsView.js';
import { HistoryView } from './components/HistoryView.js';
import { Leaderboard } from './components/Leaderboard.js';
import { useCompetition } from './hooks/useCompetition.js';
import { createServices } from '../services/index.js';
import { config } from '../config.js';
import type { Competition, Issue, Solution, PaymentRecord } from '../types/index.js';

type ViewState = 'menu' | 'competition' | 'results' | 'history' | 'leaderboard';

export function App() {
  const [currentView, setCurrentView] = useState<ViewState>('menu');
  const { competition, setCompetition, updateAgent, setWinner, setStatus, setPaymentResult } = useCompetition();

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

      // Save to MongoDB
      try {
        await services.state.saveCompetition(newCompetition);
      } catch (err) {
        console.error('[State] Failed to save competition:', err);
      }

      // Run the competition
      runCompetition(newCompetition);
    },
    [setCompetition, services]
  );

  // Run the actual competition using services
  const runCompetition = useCallback(
    async (comp: Competition) => {
      // Start competition
      await delay(300);
      setStatus('running');
      // Persist status to MongoDB
      await services.state.updateCompetition(comp.id, { status: 'running' })
        .catch(err => console.error('[State] Failed to update competition status:', err));

      // Start all agents - update local state AND persist to MongoDB
      const startedAt = Date.now();
      for (const agent of comp.agents) {
        const agentUpdate = {
          ...agent,
          status: 'solving' as const,
          startedAt,
        };
        updateAgent(agent.id, agentUpdate);
        // Persist to MongoDB (fire and forget for UI responsiveness)
        services.state.updateAgentStatus(comp.id, agentUpdate)
          .catch(err => console.error(`[State] Failed to update agent ${agent.id}:`, err));
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

          const completedAt = Date.now();
          const agentUpdate = {
            id: agentConfig.id,
            name: agentConfig.name,
            status: 'done' as const,
            completedAt,
            solution,
            startedAt: startTime,
          };
          updateAgent(agentConfig.id, agentUpdate);

          // Persist to MongoDB
          await services.state.updateAgentStatus(comp.id, agentUpdate)
            .catch(err => console.error(`[State] Failed to update agent ${agentConfig.id}:`, err));

          return solution;
        } catch (error) {
          console.error(`Agent ${agentConfig.id} failed:`, error);

          const completedAt = Date.now();
          const agentUpdate = {
            id: agentConfig.id,
            name: agentConfig.name,
            status: 'failed' as const,
            completedAt,
            startedAt: startTime,
          };
          updateAgent(agentConfig.id, agentUpdate);

          // Persist to MongoDB
          await services.state.updateAgentStatus(comp.id, agentUpdate)
            .catch(err => console.error(`[State] Failed to update agent ${agentConfig.id}:`, err));

          return null;
        }
      });

      // Wait for all agents
      const results = await Promise.all(agentPromises);

      // Judge phase
      await delay(300);
      setStatus('judging');
      // Persist status to MongoDB
      await services.state.updateCompetition(comp.id, { status: 'judging' })
        .catch(err => console.error('[State] Failed to update competition status:', err));

      // Use reviewer service to pick winner
      const successfulSolutions = results.filter((r): r is Solution => r !== null && r.success);

      if (successfulSolutions.length > 0) {
        const reviewResult = await services.reviewer.reviewSolutions(comp.issue, successfulSolutions);

        await delay(500);

        if (reviewResult.winnerId) {
          // Set winner first
          setWinner(reviewResult.winnerId);

          // Now process payment
          setStatus('paying');
          await delay(300);

          // Find winner's wallet address
          const winnerConfig = config.agents.find((a) => a.id === reviewResult.winnerId);
          const walletAddress = winnerConfig?.walletAddress;

          if (walletAddress) {
            // Create payment record
            const paymentId = nanoid();
            const paymentRecord: PaymentRecord = {
              id: paymentId,
              competitionId: comp.id,
              agentId: reviewResult.winnerId!,
              walletAddress,
              amount: comp.bountyAmount,
              txHash: '',
              status: 'pending',
              network: config.x402?.network || 'base-sepolia',
              createdAt: Date.now(),
            };

            try {
              const txHash = await services.payment.sendBonus(walletAddress, comp.bountyAmount);

              // Update payment record with success
              paymentRecord.txHash = txHash;
              paymentRecord.status = 'confirmed';
              paymentRecord.confirmedAt = Date.now();

              // Save payment record to MongoDB
              await services.state.savePaymentRecord(paymentRecord)
                .catch(err => console.error('[State] Failed to save payment record:', err));

              setPaymentResult(txHash);

              // Update competition with payment info
              await services.state.updateCompetition(comp.id, {
                status: 'completed',
                winner: reviewResult.winnerId,
                paymentTxHash: txHash,
                paymentRecord,
                completedAt: Date.now(),
              }).catch(err => console.error('[State] Update failed:', err));
            } catch (error) {
              console.error('Payment failed:', error);
              const errorMsg = error instanceof Error ? error.message : 'Payment failed';

              // Update payment record with failure
              paymentRecord.status = 'failed';
              paymentRecord.error = errorMsg;

              // Save failed payment record
              await services.state.savePaymentRecord(paymentRecord)
                .catch(err => console.error('[State] Failed to save payment record:', err));

              setPaymentResult(null, errorMsg);

              // Update competition with error
              await services.state.updateCompetition(comp.id, {
                status: 'completed',
                winner: reviewResult.winnerId,
                paymentError: errorMsg,
                paymentRecord,
                completedAt: Date.now(),
              }).catch(err => console.error('[State] Update failed:', err));
            }
          } else {
            // No wallet configured, still complete
            setPaymentResult(null, 'No wallet address configured');
            await services.state.updateCompetition(comp.id, {
              status: 'completed',
              winner: reviewResult.winnerId,
              paymentError: 'No wallet address configured',
              completedAt: Date.now(),
            }).catch(err => console.error('[State] Update failed:', err));
          }
        } else {
          setStatus('completed');
          await services.state.updateCompetition(comp.id, {
            status: 'completed',
            completedAt: Date.now(),
          }).catch(err => console.error('[State] Update failed:', err));
        }
      } else {
        await delay(500);
        setStatus('completed');
        await services.state.updateCompetition(comp.id, {
          status: 'completed',
          completedAt: Date.now(),
        }).catch(err => console.error('[State] Update failed:', err));
      }
    },
    [services, updateAgent, setStatus, setWinner, setPaymentResult]
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

// Calculate bounty based on issue labels (testnet amounts)
function calculateBounty(issue: Issue): number {
  // Random amount between $0.01 and $0.05 for testnet
  const min = 0.01;
  const max = 0.05;
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default App;
