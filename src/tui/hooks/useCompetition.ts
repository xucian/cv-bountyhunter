import { useState, useEffect, useCallback } from 'react';
import type { Competition } from '../../types/index.js';

interface UseCompetitionOptions {
  pollIntervalMs?: number;
}

interface UseCompetitionReturn {
  competition: Competition | null;
  setCompetition: (competition: Competition | null) => void;
  updateAgent: (agentId: string, updates: Partial<Competition['agents'][0]>) => void;
  setWinner: (agentId: string) => void;
  setStatus: (status: Competition['status']) => void;
  setPaymentResult: (txHash: string | null, error?: string) => void;
}

/**
 * Custom hook for managing and polling competition state.
 * In a real implementation, this would poll MongoDB for updates.
 * For now, it manages local state that can be updated externally.
 */
export function useCompetition(
  initialCompetition: Competition | null = null,
  options: UseCompetitionOptions = {}
): UseCompetitionReturn {
  const { pollIntervalMs = 500 } = options;
  const [competition, setCompetition] = useState<Competition | null>(initialCompetition);

  // Update a specific agent's status
  const updateAgent = useCallback((agentId: string, updates: Partial<Competition['agents'][0]>) => {
    setCompetition((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        agents: prev.agents.map((agent) =>
          agent.id === agentId ? { ...agent, ...updates } : agent
        ),
      };
    });
  }, []);

  // Set the winner
  const setWinner = useCallback((agentId: string) => {
    setCompetition((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        winner: agentId,
        status: 'completed',
        completedAt: Date.now(),
      };
    });
  }, []);

  // Set competition status
  const setStatus = useCallback((status: Competition['status']) => {
    setCompetition((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status,
        ...(status === 'completed' ? { completedAt: Date.now() } : {}),
      };
    });
  }, []);

  // Set payment result
  const setPaymentResult = useCallback((txHash: string | null, error?: string) => {
    setCompetition((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        paymentTxHash: txHash ?? undefined,
        paymentError: error,
        status: 'completed',
        completedAt: Date.now(),
      };
    });
  }, []);

  // Polling effect - in a real app, this would fetch from MongoDB
  useEffect(() => {
    if (!competition || competition.status === 'completed') {
      return;
    }

    const interval = setInterval(() => {
      // In production, this would be:
      // const updated = await stateStore.getCompetition(competition.id);
      // setCompetition(updated);

      // For now, state is managed locally via setCompetition
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [competition?.id, competition?.status, pollIntervalMs]);

  return {
    competition,
    setCompetition,
    updateAgent,
    setWinner,
    setStatus,
    setPaymentResult,
  };
}

export default useCompetition;
