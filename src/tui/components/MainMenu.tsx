import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface MainMenuProps {
  onStartCompetition: (repoUrl: string, issueNumber: number, bountyAmount: number) => void;
}

type InputField = 'repoUrl' | 'issueNumber' | 'bountyAmount';

export function MainMenu({ onStartCompetition }: MainMenuProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [bountyAmount, setBountyAmount] = useState('10');
  const [activeField, setActiveField] = useState<InputField>('repoUrl');
  const [error, setError] = useState<string | null>(null);

  useInput((input, key) => {
    if (key.tab || (key.return && activeField !== 'bountyAmount')) {
      // Move to next field
      if (activeField === 'repoUrl') {
        setActiveField('issueNumber');
      } else if (activeField === 'issueNumber') {
        setActiveField('bountyAmount');
      }
    } else if (key.return && activeField === 'bountyAmount') {
      handleSubmit();
    }
  });

  const handleSubmit = () => {
    setError(null);

    // Validate inputs
    if (!repoUrl.trim()) {
      setError('Repository URL is required');
      setActiveField('repoUrl');
      return;
    }

    const issueNum = parseInt(issueNumber, 10);
    if (isNaN(issueNum) || issueNum <= 0) {
      setError('Issue number must be a positive number');
      setActiveField('issueNumber');
      return;
    }

    const bounty = parseFloat(bountyAmount);
    if (isNaN(bounty) || bounty <= 0) {
      setError('Bounty amount must be a positive number');
      setActiveField('bountyAmount');
      return;
    }

    onStartCompetition(repoUrl.trim(), issueNum, bounty);
  };

  const getFieldStyle = (field: InputField) => ({
    borderStyle: 'single' as const,
    borderColor: activeField === field ? 'cyan' : 'gray',
    paddingX: 1,
    marginTop: 1,
  });

  return (
    <Box flexDirection="column" padding={2}>
      {/* Title */}
      <Box flexDirection="column" alignItems="center" marginBottom={2}>
        <Text color="cyan" bold>
          ╔═══════════════════════════════════════╗
        </Text>
        <Text color="cyan" bold>
          ║           CODE BOUNTY                 ║
        </Text>
        <Text color="cyan" bold>
          ║   AI Agents Compete to Fix Issues     ║
        </Text>
        <Text color="cyan" bold>
          ╚═══════════════════════════════════════╝
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Enter the details for the competition:</Text>
      </Box>

      {/* Repository URL Input */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={activeField === 'repoUrl' ? 'cyan' : 'white'}>
          Repository URL:
        </Text>
        <Box {...getFieldStyle('repoUrl')}>
          <TextInput
            value={repoUrl}
            onChange={setRepoUrl}
            placeholder="https://github.com/owner/repo"
            focus={activeField === 'repoUrl'}
          />
        </Box>
      </Box>

      {/* Issue Number Input */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={activeField === 'issueNumber' ? 'cyan' : 'white'}>
          Issue Number:
        </Text>
        <Box {...getFieldStyle('issueNumber')}>
          <TextInput
            value={issueNumber}
            onChange={setIssueNumber}
            placeholder="42"
            focus={activeField === 'issueNumber'}
          />
        </Box>
      </Box>

      {/* Bounty Amount Input */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={activeField === 'bountyAmount' ? 'cyan' : 'white'}>
          Bounty Amount (USDC):
        </Text>
        <Box {...getFieldStyle('bountyAmount')}>
          <TextInput
            value={bountyAmount}
            onChange={setBountyAmount}
            placeholder="10"
            focus={activeField === 'bountyAmount'}
          />
        </Box>
      </Box>

      {/* Error Message */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {/* Instructions */}
      <Box flexDirection="column" marginTop={2}>
        <Text dimColor>Press TAB or ENTER to move between fields</Text>
        <Text dimColor>Press ENTER on Bounty Amount to start</Text>
      </Box>

      {/* Start Button Indicator */}
      <Box marginTop={2} justifyContent="center">
        <Box
          borderStyle="round"
          borderColor={activeField === 'bountyAmount' ? 'green' : 'gray'}
          paddingX={3}
          paddingY={0}
        >
          <Text color={activeField === 'bountyAmount' ? 'green' : 'gray'} bold>
            [ Start Competition ]
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

export default MainMenu;
