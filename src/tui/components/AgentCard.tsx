import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentStatus } from '../../types/index.js';

interface AgentCardProps {
  agent: AgentStatus;
  isWinner?: boolean;
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

function getStatusColor(status: AgentStatus['status']): string {
  switch (status) {
    case 'idle':
      return 'gray';
    case 'solving':
      return 'yellow';
    case 'done':
      return 'green';
    case 'failed':
      return 'red';
    default:
      return 'white';
  }
}

function getStatusText(status: AgentStatus['status']): string {
  switch (status) {
    case 'idle':
      return 'Waiting';
    case 'solving':
      return 'Solving';
    case 'done':
      return 'Complete';
    case 'failed':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

export function AgentCard({ agent, isWinner = false }: AgentCardProps) {
  const statusColor = getStatusColor(agent.status);
  const elapsedTime = agent.solution?.timeMs
    ? formatTime(agent.solution.timeMs)
    : agent.startedAt && agent.status === 'solving'
      ? formatTime(Date.now() - agent.startedAt)
      : null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isWinner ? 'green' : statusColor}
      paddingX={2}
      paddingY={1}
      width={30}
    >
      {/* Agent Name */}
      <Box justifyContent="space-between">
        <Text bold color={isWinner ? 'green' : 'cyan'}>
          {agent.name}
        </Text>
        {isWinner && <Text color="green">WINNER</Text>}
      </Box>

      {/* Status */}
      <Box marginTop={1}>
        {agent.status === 'solving' ? (
          <Text color="yellow">
            <Spinner type="dots" /> {getStatusText(agent.status)}
          </Text>
        ) : (
          <Text color={statusColor}>{getStatusText(agent.status)}</Text>
        )}
      </Box>

      {/* Time */}
      {elapsedTime && (
        <Box marginTop={1}>
          <Text dimColor>Time: </Text>
          <Text color="white">{elapsedTime}</Text>
        </Box>
      )}

      {/* Success indicator for done status */}
      {agent.status === 'done' && agent.solution && (
        <Box marginTop={1}>
          <Text color={agent.solution.success ? 'green' : 'red'}>
            {agent.solution.success ? 'Solution found' : 'No solution'}
          </Text>
        </Box>
      )}

      {/* Error indicator for failed status */}
      {agent.status === 'failed' && (
        <Box marginTop={1}>
          <Text color="red">Error occurred</Text>
        </Box>
      )}
    </Box>
  );
}

export default AgentCard;
