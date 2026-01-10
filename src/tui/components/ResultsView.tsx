import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { Competition, AgentStatus } from '../../types/index.js';

interface ResultsViewProps {
  competition: Competition;
  onNewCompetition: () => void;
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

function formatDuration(startMs: number, endMs: number): string {
  const duration = endMs - startMs;
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return '1st';
    case 2:
      return '2nd';
    case 3:
      return '3rd';
    default:
      return `${rank}th`;
  }
}

function sortAgentsByPerformance(agents: AgentStatus[]): AgentStatus[] {
  return [...agents].sort((a, b) => {
    // Winners first (done with success)
    if (a.solution?.success && !b.solution?.success) return -1;
    if (!a.solution?.success && b.solution?.success) return 1;

    // Then by time (faster is better)
    const aTime = a.solution?.timeMs ?? Infinity;
    const bTime = b.solution?.timeMs ?? Infinity;
    return aTime - bTime;
  });
}

export function ResultsView({ competition, onNewCompetition }: ResultsViewProps) {
  const sortedAgents = sortAgentsByPerformance(competition.agents);
  const winner = competition.agents.find((a) => a.id === competition.winner);
  const totalDuration = competition.completedAt
    ? formatDuration(competition.createdAt, competition.completedAt)
    : 'N/A';

  useInput((input, key) => {
    if (input === 'n' || input === 'N' || key.return) {
      onNewCompetition();
    }
  });

  return (
    <Box flexDirection="column" padding={2}>
      {/* Header */}
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Text color="green" bold>
          ╔═══════════════════════════════════════╗
        </Text>
        <Text color="green" bold>
          ║        COMPETITION RESULTS            ║
        </Text>
        <Text color="green" bold>
          ╚═══════════════════════════════════════╝
        </Text>
      </Box>

      {/* Issue Summary */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Box>
          <Text dimColor>Issue: </Text>
          <Text bold>#{competition.issue.number}</Text>
          <Text> - {competition.issue.title}</Text>
        </Box>
        <Box>
          <Text dimColor>Total Duration: </Text>
          <Text>{totalDuration}</Text>
        </Box>
      </Box>

      {/* Winner Announcement */}
      {winner && (
        <Box
          flexDirection="column"
          alignItems="center"
          borderStyle="double"
          borderColor="green"
          paddingX={3}
          paddingY={1}
          marginY={1}
        >
          <Text color="yellow" bold>
            WINNER
          </Text>
          <Text color="green" bold>
            {winner.name}
          </Text>
          <Box marginTop={1}>
            <Text dimColor>Solved in: </Text>
            <Text color="cyan" bold>
              {winner.solution ? formatTime(winner.solution.timeMs) : 'N/A'}
            </Text>
          </Box>
        </Box>
      )}

      {/* Payment Info */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
        marginY={1}
      >
        <Text color="cyan" bold>
          Payment Details
        </Text>
        <Box marginTop={1}>
          <Text dimColor>Bounty Awarded: </Text>
          <Text color="green" bold>
            ${competition.bountyAmount} USDC
          </Text>
        </Box>
        <Box>
          <Text dimColor>Recipient: </Text>
          <Text>{winner?.name ?? 'N/A'}</Text>
        </Box>
        <Box>
          <Text dimColor>Status: </Text>
          <Text color="green">Paid via X402 Protocol</Text>
        </Box>
      </Box>

      {/* Agent Leaderboard */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">
          Agent Leaderboard
        </Text>
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingX={2}
          paddingY={1}
          marginTop={1}
        >
          {sortedAgents.map((agent, index) => {
            const rank = index + 1;
            const isWinner = agent.id === competition.winner;
            const time = agent.solution ? formatTime(agent.solution.timeMs) : 'N/A';
            const success = agent.solution?.success;

            return (
              <Box key={agent.id} justifyContent="space-between" paddingY={0}>
                <Box>
                  <Text color={isWinner ? 'green' : 'white'} bold={isWinner}>
                    {getRankEmoji(rank)} {agent.name}
                  </Text>
                </Box>
                <Box gap={2}>
                  <Text dimColor>{time}</Text>
                  <Text color={success ? 'green' : agent.status === 'failed' ? 'red' : 'yellow'}>
                    {success ? 'SUCCESS' : agent.status === 'failed' ? 'FAILED' : 'NO SOLUTION'}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* New Competition Option */}
      <Box flexDirection="column" alignItems="center" marginTop={2}>
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={3}
          paddingY={0}
        >
          <Text color="cyan" bold>
            [ Press N or ENTER to Start New Competition ]
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

export default ResultsView;
