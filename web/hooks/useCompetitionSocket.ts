'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Competition, Solution, AgentStatus } from '@/lib/services';

// Event types from the WebSocket server
type CompetitionEventType =
  | 'competition:sync'
  | 'competition:created'
  | 'competition:started'
  | 'agent:solving'
  | 'agent:done'
  | 'agent:failed'
  | 'competition:judging'
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
  };
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
            return;
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

  return { competition, connected, events, error };
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
