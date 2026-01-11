'use client';

import { useState, useEffect, useRef } from 'react';
import { cn, truncate } from '@/lib/utils';
import type { Issue } from '@/lib/services';
import { Loader2, Search, Plus, ExternalLink } from 'lucide-react';

interface IssueSelectorProps {
  onSelectIssue: (issue: Issue) => void;
  disabled?: boolean;
}

// Check if string looks like a complete GitHub repo URL
function isValidGitHubUrl(url: string): boolean {
  return /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(url.trim());
}

export function IssueSelector({ onSelectIssue, disabled }: IssueSelectorProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const lastLoadedUrl = useRef<string>('');

  // New issue form
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [creating, setCreating] = useState(false);

  // Auto-load issues when a valid GitHub URL is pasted
  useEffect(() => {
    if (
      isValidGitHubUrl(repoUrl) &&
      repoUrl !== lastLoadedUrl.current &&
      !loading
    ) {
      lastLoadedUrl.current = repoUrl;
      loadIssues();
    }
  }, [repoUrl]);

  const loadIssues = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    setLoading(true);
    setError(null);
    setIssues([]);
    setSelectedIssue(null);

    try {
      const res = await fetch(`/api/github/issues?repo=${encodeURIComponent(repoUrl.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load issues');
      }

      setIssues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const createIssue = async () => {
    if (!newTitle.trim()) {
      setError('Issue title is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/github/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: repoUrl.trim(),
          title: newTitle.trim(),
          body: newBody.trim() || 'Created via Bounty Hunter',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create issue');
      }

      // Select the newly created issue
      setSelectedIssue(data);
      setShowNewIssue(false);
      setNewTitle('');
      setNewBody('');

      // Add to issues list
      setIssues((prev) => [data, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setCreating(false);
    }
  };

  const handleStart = () => {
    if (selectedIssue) {
      onSelectIssue(selectedIssue);
    }
  };

  return (
    <div className="space-y-4">
      {/* Repository Input */}
      <div>
        <label className="block text-sm font-medium mb-2">Repository URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={disabled || loading}
            onKeyDown={(e) => e.key === 'Enter' && loadIssues()}
          />
          <button
            onClick={loadIssues}
            disabled={disabled || loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Load
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Issues List */}
      {issues.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Select an Issue</label>
            <button
              onClick={() => setShowNewIssue(!showNewIssue)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Create new
            </button>
          </div>

          {/* New Issue Form */}
          {showNewIssue && (
            <div className="mb-4 p-4 border border-border rounded-md space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Issue title"
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Issue description (optional)"
                rows={3}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <button
                onClick={createIssue}
                disabled={creating}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create & Select
              </button>
            </div>
          )}

          {/* Issue List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {issues.map((issue) => (
              <button
                key={issue.number}
                onClick={() => setSelectedIssue(issue)}
                disabled={disabled}
                className={cn(
                  'w-full text-left p-3 rounded-md border transition-colors',
                  selectedIssue?.number === issue.number
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-green-500 font-mono text-sm">#{issue.number}</span>
                    <span className="ml-2 font-medium">{truncate(issue.title, 50)}</span>
                  </div>
                  <a
                    href={`${issue.repoUrl}/issues/${issue.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                {issue.labels.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {issue.labels.slice(0, 3).map((label) => (
                      <span key={label} className="px-1.5 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Issues */}
      {issues.length === 0 && !loading && repoUrl && !error && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No open issues found.</p>
          <button
            onClick={() => setShowNewIssue(true)}
            className="mt-2 text-primary hover:underline"
          >
            Create a new issue
          </button>
        </div>
      )}

      {/* Start Button */}
      {selectedIssue && (
        <button
          onClick={handleStart}
          disabled={disabled}
          className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-md hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          Start Competition
        </button>
      )}
    </div>
  );
}

export default IssueSelector;
