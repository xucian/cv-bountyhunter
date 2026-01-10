import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { AgentCard } from './AgentCard.js';
import type { Competition } from '../../types/index.js';

interface CompetitionViewProps {
  competition: Competition;
}

function getStatusDisplay(status: Competition['status']): { text: string; color: string } {
  switch (status) {
    case 'pending':
      return { text: 'Initializing', color: 'gray' };
    case 'running':
      return { text: 'Agents Racing', color: 'yellow' };
    case 'judging':
      return { text: 'Reviewing Solutions', color: 'cyan' };
    case 'paying':
      return { text: 'Processing Payment', color: 'magenta' };
    case 'completed':
      return { text: 'Competition Complete', color: 'green' };
    default:
      return { text: 'Unknown', color: 'white' };
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function CompetitionView({ competition }: CompetitionViewProps) {
  const statusDisplay = getStatusDisplay(competition.status);
  const isRunning = competition.status === 'running' || competition.status === 'judging' || competition.status === 'paying';
  const completedAgents = competition.agents.filter((a) => a.status === 'done' || a.status === 'failed').length;
  const totalAgents = competition.agents.length;

  return (
    <Box flexDirection="column" padding={2}>
      {/* Header */}
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Text color="cyan" bold>
          CODE BOUNTY - Live Competition
        </Text>
      </Box>

      {/* Issue Info */}
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
          <Text bold color="white">
            #{competition.issue.number}
          </Text>
          <Text> - </Text>
          <Text>{truncateText(competition.issue.title, 50)}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Repo: </Text>
          <Text color="cyan">{competition.issue.repoUrl}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Bounty: </Text>
          <Text color="green" bold>
            ${competition.bountyAmount} USDC
          </Text>
        </Box>
      </Box>

      {/* Competition Status */}
      <Box marginY={1} justifyContent="center">
        {isRunning ? (
          <Text color={statusDisplay.color}>
            <Spinner type="dots" /> {statusDisplay.text}
          </Text>
        ) : (
          <Text color={statusDisplay.color} bold>
            {statusDisplay.text}
          </Text>
        )}
      </Box>

      {/* Progress */}
      <Box justifyContent="center" marginBottom={1}>
        <Text dimColor>
          Progress: {completedAgents}/{totalAgents} agents finished
        </Text>
      </Box>

      {/* Agent Cards */}
      <Box justifyContent="center" gap={2}>
        {competition.agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isWinner={competition.winner === agent.id}
          />
        ))}
      </Box>

      {/* Winner Announcement (if completed) */}
      {competition.status === 'completed' && competition.winner && (
        <Box flexDirection="column" alignItems="center" marginTop={2}>
          <Box
            borderStyle="double"
            borderColor="green"
            paddingX={3}
            paddingY={1}
          >
            <Text color="green" bold>
              WINNER: {competition.agents.find((a) => a.id === competition.winner)?.name}
            </Text>
          </Box>
        </Box>
      )}

      {/* Instructions */}
      <Box marginTop={2} justifyContent="center">
        <Text dimColor>
          {competition.status === 'completed'
            ? 'Press any key to view detailed results'
            : 'Competition in progress...'}
        </Text>
      </Box>
    </Box>
  );
}

export default CompetitionView;
