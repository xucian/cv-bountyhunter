'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Competition, Solution, AgentStatus } from '@/lib/services';

// Event types from the WebSocket server
type CompetitionEventType =
  | 'competition:sync'
  | 'competition:created'
  | 'competition:started'
  | 'rag:indexing'
  | 'rag:progress'
  | 'rag:complete'
  | 'agent:solving'
  | 'agent:streaming'
  | 'agent:done'
  | 'agent:failed'
  | 'competition:judging'
  | 'judging:streaming'
  | 'competition:paying'
  | 'competition:completed';

interface CompetitionEvent {
  type: CompetitionEventType;
  competitionId: string;
  timestamp: number;
  payload: {
    competition?: Competition;
    agentId?: string;
    agentName?: string;
    solution?: Solution;
    winner?: string;
    txHash?: string;
    error?: string;
    reviewResult?: any;
    chunk?: string;
    accumulated?: string;
    // RAG event fields
    repoUrl?: string;
    message?: string;
    stage?: 'scanning' | 'parsing' | 'embedding' | 'querying';
    current?: number;
    total?: number;
    chunksIndexed?: number;
    chunksFound?: number;
  };
}

// RAG progress state
interface RAGProgress {
  stage: 'scanning' | 'parsing' | 'embedding' | 'querying' | 'complete' | 'idle';
  message: string;
  current?: number;
  total?: number;
  chunksFound?: number;
}

// Streaming state for agents, judge, and RAG
interface StreamingState {
  agentCode: Record<string, string>; // agentId -> accumulated code
  judgingThinking: string;
  ragProgress: RAGProgress;
}

interface UseCompetitionSocketOptions {
  competitionId: string;
  wsUrl?: string;
  onEvent?: (event: CompetitionEvent) => void;
}

interface UseCompetitionSocketReturn {
  competition: Competition | null;
  connected: boolean;
  events: CompetitionEvent[];
  error: string | null;
  streaming: StreamingState;
}

/**
 * Hook for subscribing to real-time competition updates via WebSocket
 */
export function useCompetitionSocket({
  competitionId,
  wsUrl = 'ws://localhost:4000',
  onEvent,
}: UseCompetitionSocketOptions): UseCompetitionSocketReturn {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<CompetitionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<StreamingState>({
    agentCode: {},
    judgingThinking: '',
    ragProgress: { stage: 'idle', message: '' },
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setConnected(true);
        setError(null);

        // Subscribe to competition updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          competitionId,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as CompetitionEvent;
          console.log('[WS] Event:', data.type);

          // Handle initial sync
          if (data.type === 'competition:sync' && data.payload.competition) {
            setCompetition(data.payload.competition);
            // Reset streaming state on sync
            setStreaming({ agentCode: {}, judgingThinking: '', ragProgress: { stage: 'idle', message: '' } });
            return;
          }

          // Handle RAG events
          if (data.type === 'rag:indexing') {
            setStreaming((prev) => ({
              ...prev,
              ragProgress: {
                stage: 'scanning',
                message: data.payload.message || 'Starting code analysis...',
              },
            }));
            return;
          }

          if (data.type === 'rag:progress') {
            setStreaming((prev) => ({
              ...prev,
              ragProgress: {
                stage: data.payload.stage || 'scanning',
                message: data.payload.message || '',
                current: data.payload.current,
                total: data.payload.total,
              },
            }));
            return;
          }

          if (data.type === 'rag:complete') {
            setStreaming((prev) => ({
              ...prev,
              ragProgress: {
                stage: 'complete',
                message: data.payload.message || 'Code analysis complete',
                chunksFound: data.payload.chunksFound,
              },
            }));
            // Don't return - let it add to events
          }

          // Handle streaming events
          if (data.type === 'agent:streaming' && data.payload.agentId && data.payload.accumulated) {
            setStreaming((prev) => ({
              ...prev,
              agentCode: {
                ...prev.agentCode,
                [data.payload.agentId!]: data.payload.accumulated!,
              },
            }));
            return; // Don't add to events list (too many)
          }

          if (data.type === 'judging:streaming' && data.payload.accumulated) {
            setStreaming((prev) => ({
              ...prev,
              judgingThinking: data.payload.accumulated!,
            }));
            return; // Don't add to events list (too many)
          }

          // Apply incremental updates
          setCompetition((prev) => applyEvent(prev, data));
          setEvents((prev) => [...prev.slice(-50), data]); // Keep last 50 events
          onEvent?.(data);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        setConnected(false);

        // Attempt to reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WS] Attempting to reconnect...');
          connect();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        setError('WebSocket connection error');
      };
    } catch (err) {
      console.error('[WS] Failed to connect:', err);
      setError('Failed to connect to WebSocket server');
    }
  }, [competitionId, wsUrl, onEvent]);

  useEffect(() => {
    connect();

    return () => {
      // Clean up
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        // Only send unsubscribe if connection is open
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'unsubscribe',
            competitionId,
          }));
        }
        wsRef.current.close();
      }
    };
  }, [connect, competitionId]);

  return { competition, connected, events, error, streaming };
}

/**
 * Apply an event to update the competition state
 */
function applyEvent(
  competition: Competition | null,
  event: CompetitionEvent
): Competition | null {
  if (!competition) return null;

  switch (event.type) {
    case 'competition:started':
      return {
        ...competition,
        status: 'running',
        ...(event.payload.competition ? { agents: event.payload.competition.agents } : {}),
      };

    case 'agent:solving':
      return {
        ...competition,
        agents: competition.agents.map((a) =>
          a.id === event.payload.agentId
            ? { ...a, status: 'solving' as const, startedAt: event.timestamp }
            : a
        ),
      };

    case 'agent:done':
      return {
        ...competition,
        agents: competition.agents.map((a) =>
          a.id === event.payload.agentId
            ? {
                ...a,
                status: 'done' as const,
                solution: event.payload.solution,
                completedAt: event.timestamp,
              }
            : a
        ),
      };

    case 'agent:failed':
      return {
        ...competition,
        agents: competition.agents.map((a) =>
          a.id === event.payload.agentId
            ? { ...a, status: 'failed' as const, completedAt: event.timestamp }
            : a
        ),
      };

    case 'competition:judging':
      return { ...competition, status: 'judging' };

    case 'competition:paying':
      return {
        ...competition,
        status: 'paying',
        winner: event.payload.winner,
        reviewResult: event.payload.reviewResult,
      };

    case 'competition:completed':
      return {
        ...competition,
        status: 'completed',
        winner: event.payload.winner || competition.winner,
        paymentTxHash: event.payload.txHash,
        paymentError: event.payload.error,
        completedAt: event.timestamp,
        ...(event.payload.competition ? event.payload.competition : {}),
      };

    default:
      return competition;
  }
}

export default useCompetitionSocket;
