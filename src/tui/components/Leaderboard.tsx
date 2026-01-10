import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Competition } from '../../types/index.js';
import type { IStateStore } from '../../types/services.js';
import { config } from '../../config.js';

interface LeaderboardProps {
  stateService: IStateStore;
  onBack: () => void;
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

export function Leaderboard({ stateService, onBack }: LeaderboardProps) {
  const [stats, setStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCompetitions, setTotalCompetitions] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);

  useEffect(() => {
    async function loadStats() {
      try {
        const competitions = await stateService.listCompetitions();
        const completedComps = competitions.filter((c) => c.status === 'completed');

        // Initialize stats for all configured agents
        const agentStats: Record<string, AgentStats> = {};
        for (const agent of config.agents) {
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

        let totalPaidAmount = 0;

        // Calculate stats from competitions
        for (const comp of completedComps) {
          const winnerId = comp.winner;

          for (const agent of comp.agents) {
            if (!agentStats[agent.id]) continue;

            agentStats[agent.id].competitions++;

            if (agent.id === winnerId) {
              agentStats[agent.id].wins++;
              agentStats[agent.id].totalEarnings += comp.bountyAmount;
              totalPaidAmount += comp.bountyAmount;
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
        const sortedStats = Object.values(agentStats).sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.totalEarnings - a.totalEarnings;
        });

        setStats(sortedStats);
        setTotalCompetitions(completedComps.length);
        setTotalPaid(totalPaidAmount);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [stateService]);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onBack();
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="cyan">Loading leaderboard...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press ESC to go back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={2}>
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Text color="yellow" bold>
          AGENT LEADERBOARD
        </Text>
      </Box>

      {/* Summary Stats */}
      <Box
        flexDirection="row"
        justifyContent="center"
        marginBottom={1}
        gap={4}
      >
        <Box>
          <Text dimColor>Total Competitions: </Text>
          <Text color="cyan" bold>{totalCompetitions}</Text>
        </Box>
        <Box>
          <Text dimColor>Total Paid: </Text>
          <Text color="green" bold>${totalPaid.toFixed(2)} USDC</Text>
        </Box>
      </Box>

      {/* Leaderboard Table */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={2}
        paddingY={1}
      >
        {/* Header */}
        <Box marginBottom={1}>
          <Box width={5}>
            <Text bold color="yellow">#</Text>
          </Box>
          <Box width={18}>
            <Text bold>Agent</Text>
          </Box>
          <Box width={8}>
            <Text bold color="green">Wins</Text>
          </Box>
          <Box width={10}>
            <Text bold color="red">Losses</Text>
          </Box>
          <Box width={10}>
            <Text bold>Win %</Text>
          </Box>
          <Box width={14}>
            <Text bold color="green">Earnings</Text>
          </Box>
          <Box width={10}>
            <Text bold color="cyan">Avg Score</Text>
          </Box>
        </Box>

        {/* Rows */}
        {stats.map((agent, index) => {
          const winRate = agent.competitions > 0
            ? ((agent.wins / agent.competitions) * 100).toFixed(0)
            : '0';
          const medal = index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}`;
          const medalColor = index === 0 ? 'yellow' : index === 1 ? 'gray' : index === 2 ? 'red' : 'white';

          return (
            <Box key={agent.id}>
              <Box width={5}>
                <Text color={medalColor} bold>{medal}</Text>
              </Box>
              <Box width={18}>
                <Text>{agent.name}</Text>
              </Box>
              <Box width={8}>
                <Text color="green">{agent.wins}</Text>
              </Box>
              <Box width={10}>
                <Text color="red">{agent.losses}</Text>
              </Box>
              <Box width={10}>
                <Text>{winRate}%</Text>
              </Box>
              <Box width={14}>
                <Text color="green">${agent.totalEarnings.toFixed(2)}</Text>
              </Box>
              <Box width={10}>
                <Text color="cyan">{agent.avgScore.toFixed(1)}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press ESC or Q to go back</Text>
      </Box>
    </Box>
  );
}

export default Leaderboard;
