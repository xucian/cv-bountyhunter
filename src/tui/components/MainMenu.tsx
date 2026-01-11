import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Issue } from '../../types/index.js';
import type { IGitHubService } from '../../types/services.js';

interface MainMenuProps {
  githubService: IGitHubService;
  onStartCompetition: (issue: Issue) => void | Promise<void>;
  onViewHistory?: () => void;
  onViewLeaderboard?: () => void;
}

type Screen = 'loading' | 'repo' | 'issues' | 'create-issue';

export function MainMenu({ githubService, onStartCompetition, onViewHistory, onViewLeaderboard }: MainMenuProps) {
  const [screen, setScreen] = useState<Screen>('loading');
  const [repoUrl, setRepoUrl] = useState('');
  const [recentRepos, setRecentRepos] = useState<string[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New issue form
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueBody, setNewIssueBody] = useState('');
  const [activeField, setActiveField] = useState<'title' | 'body'>('title');

  // Load current repo on mount
  useEffect(() => {
    async function init() {
      const [currentRepo, recent] = await Promise.all([
        githubService.getCurrentRepo(),
        githubService.getRecentRepos(),
      ]);

      setRecentRepos(recent);

      if (currentRepo) {
        setRepoUrl(currentRepo);
        await loadIssues(currentRepo);
      } else if (recent.length > 0) {
        setRepoUrl(recent[0]);
        await loadIssues(recent[0]);
      } else {
        setScreen('repo');
      }
    }
    init();
  }, []);

  const loadIssues = async (repo: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedIssues = await githubService.listIssues(repo, 10);
      setIssues(fetchedIssues);
      setScreen('issues');
      await githubService.addRecentRepo(repo);
    } catch (err) {
      setError('Failed to load issues');
      setScreen('repo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateIssue = async () => {
    if (!newIssueTitle.trim()) {
      setError('Issue title is required');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[MainMenu] Creating new issue:', newIssueTitle);
      const issue = await githubService.createIssue(
        repoUrl,
        newIssueTitle.trim(),
        newIssueBody.trim() || 'Created via Bounty Hunter'
      );
      console.log('[MainMenu] Issue created:', issue.number);
      console.log('[MainMenu] Calling onStartCompetition for new issue...');
      onStartCompetition(issue);
      console.log('[MainMenu] onStartCompetition called for new issue');
    } catch (err) {
      console.error('[MainMenu] Failed to create issue:', err);
      setError('Failed to create issue');
    } finally {
      setIsLoading(false);
    }
  };

  useInput((input, key) => {
    if (isLoading) return;

    if (screen === 'repo') {
      if (key.return && repoUrl.trim()) {
        loadIssues(repoUrl.trim());
      }
    } else if (screen === 'issues') {
      if (key.upArrow) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (key.downArrow) {
        setSelectedIndex(Math.min(issues.length, selectedIndex + 1));
      } else if (key.return) {
        if (selectedIndex === issues.length) {
          // "Create new issue" option
          setScreen('create-issue');
          setSelectedIndex(0);
        } else if (issues[selectedIndex]) {
          console.log('[MainMenu] User selected issue:', issues[selectedIndex].number);
          console.log('[MainMenu] Calling onStartCompetition...');
          onStartCompetition(issues[selectedIndex]);
          console.log('[MainMenu] onStartCompetition called');
        }
      } else if (input === 'r' || input === 'R') {
        setScreen('repo');
      } else if (input === 'n' || input === 'N') {
        setScreen('create-issue');
        setSelectedIndex(0);
      } else if ((input === 'h' || input === 'H') && onViewHistory) {
        onViewHistory();
      } else if ((input === 'l' || input === 'L') && onViewLeaderboard) {
        onViewLeaderboard();
      }
    } else if (screen === 'create-issue') {
      if (key.tab) {
        setActiveField(activeField === 'title' ? 'body' : 'title');
      } else if (key.return && activeField === 'body') {
        handleCreateIssue();
      } else if (key.escape) {
        setScreen('issues');
      }
    }
  });

  // Loading screen
  if (screen === 'loading' || isLoading) {
    return (
      <Box flexDirection="column" padding={2}>
        <Header />
        <Box marginTop={2}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Loading...</Text>
        </Box>
      </Box>
    );
  }

  // Repo selection screen
  if (screen === 'repo') {
    return (
      <Box flexDirection="column" padding={2}>
        <Header />
        <Box flexDirection="column" marginTop={2}>
          <Text bold>Repository:</Text>
          <Box borderStyle="single" borderColor="cyan" paddingX={1} marginTop={1}>
            <TextInput
              value={repoUrl}
              onChange={setRepoUrl}
              placeholder="https://github.com/owner/repo"
              focus={true}
            />
          </Box>
        </Box>

        {recentRepos.length > 0 && (
          <Box flexDirection="column" marginTop={2}>
            <Text dimColor>Recent:</Text>
            {recentRepos.slice(0, 5).map((repo, i) => (
              <Text key={i} dimColor>  {repo}</Text>
            ))}
          </Box>
        )}

        {error && (
          <Box marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}

        <Box marginTop={2}>
          <Text dimColor>Press ENTER to load issues</Text>
        </Box>
      </Box>
    );
  }

  // Issue selection screen
  if (screen === 'issues') {
    return (
      <Box flexDirection="column" padding={2}>
        <Header />

        <Box marginTop={1}>
          <Text dimColor>Repo: </Text>
          <Text color="cyan">{repoUrl}</Text>
          <Text dimColor> (press 'r' to change)</Text>
        </Box>

        <Box flexDirection="column" marginTop={2}>
          <Text bold>Select an issue or create new:</Text>

          <Box flexDirection="column" marginTop={1}>
            {issues.length === 0 ? (
              <Text dimColor>  No open issues found</Text>
            ) : (
              issues.map((issue, i) => (
                <Box key={issue.number}>
                  <Text color={selectedIndex === i ? 'cyan' : 'white'}>
                    {selectedIndex === i ? '> ' : '  '}
                  </Text>
                  <Text color={selectedIndex === i ? 'cyan' : 'green'}>#{issue.number}</Text>
                  <Text color={selectedIndex === i ? 'cyan' : 'white'}> {issue.title.slice(0, 50)}{issue.title.length > 50 ? '...' : ''}</Text>
                </Box>
              ))
            )}

            {/* Create new issue option */}
            <Box marginTop={1}>
              <Text color={selectedIndex === issues.length ? 'cyan' : 'yellow'}>
                {selectedIndex === issues.length ? '> ' : '  '}
                + Create new issue
              </Text>
            </Box>
          </Box>
        </Box>

        <Box marginTop={2} flexDirection="column">
          <Text dimColor>↑↓ select | ENTER confirm | N new issue | R change repo</Text>
          <Text dimColor>H history | L leaderboard</Text>
        </Box>
      </Box>
    );
  }

  // Create issue screen
  if (screen === 'create-issue') {
    return (
      <Box flexDirection="column" padding={2}>
        <Header />

        <Box marginTop={1}>
          <Text dimColor>Creating issue in: </Text>
          <Text color="cyan">{repoUrl}</Text>
        </Box>

        <Box flexDirection="column" marginTop={2}>
          <Text color={activeField === 'title' ? 'cyan' : 'white'}>Issue Title:</Text>
          <Box borderStyle="single" borderColor={activeField === 'title' ? 'cyan' : 'gray'} paddingX={1} marginTop={1}>
            <TextInput
              value={newIssueTitle}
              onChange={setNewIssueTitle}
              placeholder="Describe the problem briefly"
              focus={activeField === 'title'}
            />
          </Box>
        </Box>

        <Box flexDirection="column" marginTop={2}>
          <Text color={activeField === 'body' ? 'cyan' : 'white'}>Description (optional):</Text>
          <Box borderStyle="single" borderColor={activeField === 'body' ? 'cyan' : 'gray'} paddingX={1} marginTop={1}>
            <TextInput
              value={newIssueBody}
              onChange={setNewIssueBody}
              placeholder="More details about the issue..."
              focus={activeField === 'body'}
            />
          </Box>
        </Box>

        {error && (
          <Box marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}

        <Box marginTop={2} flexDirection="column">
          <Text dimColor>TAB to switch fields, ENTER to create, ESC to go back</Text>
        </Box>

        <Box marginTop={2} justifyContent="center">
          <Box
            borderStyle="round"
            borderColor={activeField === 'body' ? 'green' : 'gray'}
            paddingX={3}
          >
            <Text color={activeField === 'body' ? 'green' : 'gray'} bold>
              [ Create & Start Competition ]
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
}

function Header() {
  return (
    <Box flexDirection="column" alignItems="center">
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
  );
}

export default MainMenu;
