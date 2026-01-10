import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { Competition, AgentStatus } from '../../types/index.js';
import type { IGitHubService } from '../../types/services.js';

interface ResultsViewProps {
  competition: Competition;
  githubService: IGitHubService;
  onNewCompetition: () => void;
}

type SelectedAction = 'pr' | 'new';

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

export function ResultsView({ competition, githubService, onNewCompetition }: ResultsViewProps) {
  const [selectedAction, setSelectedAction] = useState<SelectedAction>('pr');
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [prError, setPrError] = useState<string | null>(null);

  const sortedAgents = sortAgentsByPerformance(competition.agents);
  const winner = competition.agents.find((a) => a.id === competition.winner);
  const totalDuration = competition.completedAt
    ? formatDuration(competition.createdAt, competition.completedAt)
    : 'N/A';

  const handleCreatePR = async () => {
    if (!winner?.solution) return;

    setIsCreatingPR(true);
    setPrError(null);

    try {
      const url = await githubService.createSolutionPR(
        competition.issue,
        winner.solution,
        winner.name
      );
      setPrUrl(url);
    } catch (err) {
      setPrError('Failed to create PR');
    } finally {
      setIsCreatingPR(false);
    }
  };

  useInput((input, key) => {
    if (isCreatingPR) return;

    if (key.leftArrow || key.rightArrow) {
      setSelectedAction(selectedAction === 'pr' ? 'new' : 'pr');
    } else if (key.return) {
      if (selectedAction === 'pr' && winner?.solution && !prUrl) {
        handleCreatePR();
      } else if (selectedAction === 'new' || prUrl) {
        onNewCompetition();
      }
    } else if (input === 'n' || input === 'N') {
      onNewCompetition();
    } else if (input === 'p' || input === 'P') {
      if (winner?.solution && !prUrl) {
        handleCreatePR();
      }
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

      {/* PR Status */}
      {prUrl && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="green"
          paddingX={2}
          paddingY={1}
          marginY={1}
        >
          <Text color="green" bold>
            Pull Request Created!
          </Text>
          <Box marginTop={1}>
            <Text color="cyan">{prUrl}</Text>
          </Box>
        </Box>
      )}

      {prError && (
        <Box marginY={1}>
          <Text color="red">{prError}</Text>
        </Box>
      )}

      {/* Winning Solution Preview */}
      {winner?.solution && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="yellow"
          paddingX={2}
          paddingY={1}
          marginY={1}
        >
          <Text color="yellow" bold>
            Winning Solution
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>
              {winner.solution.code.slice(0, 500)}
              {winner.solution.code.length > 500 ? '...' : ''}
            </Text>
          </Box>
        </Box>
      )}

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

      {/* Actions */}
      <Box flexDirection="column" alignItems="center" marginTop={2}>
        {isCreatingPR ? (
          <Box>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text> Creating Pull Request...</Text>
          </Box>
        ) : (
          <Box gap={2}>
            {winner?.solution && !prUrl && (
              <Box
                borderStyle="round"
                borderColor={selectedAction === 'pr' ? 'green' : 'gray'}
                paddingX={2}
              >
                <Text color={selectedAction === 'pr' ? 'green' : 'gray'} bold>
                  [ P - Create PR ]
                </Text>
              </Box>
            )}
            <Box
              borderStyle="round"
              borderColor={selectedAction === 'new' || prUrl ? 'cyan' : 'gray'}
              paddingX={2}
            >
              <Text color={selectedAction === 'new' || prUrl ? 'cyan' : 'gray'} bold>
                [ N - New Competition ]
              </Text>
            </Box>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>Use arrow keys to select, ENTER to confirm</Text>
        </Box>
      </Box>
    </Box>
  );
}

export default ResultsView;
