import type { Competition, Solution, AgentStatus, ReviewResult, PaymentRecord } from './index.js';

/**
 * Event types for real-time competition updates
 * Used by WebSocket server to broadcast to connected clients
 */
export type CompetitionEventType =
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
  | 'competition:completed'
  | 'competition:sync';

/**
 * Base event structure
 */
export interface CompetitionEventBase {
  type: CompetitionEventType;
  competitionId: string;
  timestamp: number;
}

/**
 * Full competition sync (sent on initial subscribe)
 */
export interface CompetitionSyncEvent extends CompetitionEventBase {
  type: 'competition:sync';
  payload: {
    competition: Competition;
  };
}

/**
 * Competition created but not started
 */
export interface CompetitionCreatedEvent extends CompetitionEventBase {
  type: 'competition:created';
  payload: {
    competition: Competition;
  };
}

/**
 * Competition started, agents beginning work
 */
export interface CompetitionStartedEvent extends CompetitionEventBase {
  type: 'competition:started';
  payload: {
    competition: Competition;
  };
}

/**
 * RAG indexing started
 */
export interface RAGIndexingEvent extends CompetitionEventBase {
  type: 'rag:indexing';
  payload: {
    repoUrl: string;
    message: string;
  };
}

/**
 * RAG indexing progress update
 */
export interface RAGProgressEvent extends CompetitionEventBase {
  type: 'rag:progress';
  payload: {
    stage: 'scanning' | 'parsing' | 'embedding' | 'querying';
    message: string;
    current?: number;
    total?: number;
  };
}

/**
 * RAG indexing/querying complete
 */
export interface RAGCompleteEvent extends CompetitionEventBase {
  type: 'rag:complete';
  payload: {
    chunksIndexed?: number;
    chunksFound?: number;
    message: string;
  };
}

/**
 * Agent started solving
 */
export interface AgentSolvingEvent extends CompetitionEventBase {
  type: 'agent:solving';
  payload: {
    agentId: string;
    agentName: string;
  };
}

/**
 * Agent streaming partial code
 */
export interface AgentStreamingEvent extends CompetitionEventBase {
  type: 'agent:streaming';
  payload: {
    agentId: string;
    agentName: string;
    chunk: string;
    accumulated: string;
  };
}

/**
 * Agent completed successfully
 */
export interface AgentDoneEvent extends CompetitionEventBase {
  type: 'agent:done';
  payload: {
    agentId: string;
    agentName: string;
    solution: Solution;
  };
}

/**
 * Agent failed
 */
export interface AgentFailedEvent extends CompetitionEventBase {
  type: 'agent:failed';
  payload: {
    agentId: string;
    agentName: string;
    error: string;
  };
}

/**
 * All agents done, judging phase started
 */
export interface CompetitionJudgingEvent extends CompetitionEventBase {
  type: 'competition:judging';
  payload: Record<string, never>;
}

/**
 * Judge streaming thinking/reasoning
 */
export interface JudgingStreamingEvent extends CompetitionEventBase {
  type: 'judging:streaming';
  payload: {
    chunk: string;
    accumulated: string;
  };
}

/**
 * Winner selected, payment in progress
 */
export interface CompetitionPayingEvent extends CompetitionEventBase {
  type: 'competition:paying';
  payload: {
    winner: string;
    reviewResult: ReviewResult;
  };
}

/**
 * Competition fully completed
 */
export interface CompetitionCompletedEvent extends CompetitionEventBase {
  type: 'competition:completed';
  payload: {
    competition: Competition;
    winner?: string;
    txHash?: string;
    error?: string;
    prUrl?: string;
  };
}

/**
 * Union type for all competition events
 */
export type CompetitionEvent =
  | CompetitionSyncEvent
  | CompetitionCreatedEvent
  | CompetitionStartedEvent
  | RAGIndexingEvent
  | RAGProgressEvent
  | RAGCompleteEvent
  | AgentSolvingEvent
  | AgentStreamingEvent
  | AgentDoneEvent
  | AgentFailedEvent
  | CompetitionJudgingEvent
  | JudgingStreamingEvent
  | CompetitionPayingEvent
  | CompetitionCompletedEvent;

/**
 * WebSocket client messages
 */
export type WSClientMessage =
  | { type: 'subscribe'; competitionId: string }
  | { type: 'unsubscribe'; competitionId: string };
