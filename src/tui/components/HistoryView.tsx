import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Competition } from '../../types/index.js';
import type { IStateStore } from '../../types/services.js';

interface HistoryViewProps {
  stateService: IStateStore;
  onBack: () => void;
  onSelectCompetition: (competition: Competition) => void;
}

export function HistoryView({ stateService, onBack, onSelectCompetition }: HistoryViewProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await stateService.listCompetitions();
        setCompetitions(history);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [stateService]);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onBack();
      return;
    }

    if (competitions.length === 0) return;

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(competitions.length - 1, prev + 1));
    } else if (key.return) {
      onSelectCompetition(competitions[selectedIndex]);
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="cyan">Loading competition history...</Text>
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
        <Text color="cyan" bold>
          COMPETITION HISTORY
        </Text>
        <Text dimColor>{competitions.length} competitions found</Text>
      </Box>

      {competitions.length === 0 ? (
        <Box justifyContent="center" marginY={2}>
          <Text dimColor>No competitions yet. Start one from the main menu!</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginY={1}>
          {competitions.slice(0, 10).map((comp, index) => {
            const isSelected = index === selectedIndex;
            const winnerAgent = comp.agents.find((a) => a.id === comp.winner);
            const date = new Date(comp.createdAt).toLocaleDateString();
            const time = new Date(comp.createdAt).toLocaleTimeString();

            return (
              <Box
                key={comp.id}
                paddingX={2}
                paddingY={0}
                borderStyle={isSelected ? 'single' : undefined}
                borderColor={isSelected ? 'cyan' : undefined}
              >
                <Box width={3}>
                  <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? '>' : ' '}</Text>
                </Box>
                <Box width={20}>
                  <Text color={comp.status === 'completed' ? 'green' : 'yellow'}>
                    {comp.status === 'completed' ? 'Done' : comp.status}
                  </Text>
                </Box>
                <Box width={30}>
                  <Text>#{comp.issue.number} - {truncate(comp.issue.title, 25)}</Text>
                </Box>
                <Box width={15}>
                  <Text color="green">${comp.bountyAmount.toFixed(2)}</Text>
                </Box>
                <Box width={15}>
                  <Text color="magenta">{winnerAgent?.name || 'N/A'}</Text>
                </Box>
                <Box>
                  <Text dimColor>{date} {time}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {competitions.length > 10 && (
        <Text dimColor>Showing 10 of {competitions.length} competitions</Text>
      )}

      <Box marginTop={2} flexDirection="column">
        <Text dimColor>Controls:</Text>
        <Text dimColor>  Up/Down - Navigate | Enter - View Details | ESC/Q - Back</Text>
      </Box>
    </Box>
  );
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 3) + '...' : str;
}

export default HistoryView;
