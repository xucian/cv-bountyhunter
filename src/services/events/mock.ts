import { EventEmitter } from 'events';
import type { IEventEmitter } from '../../types/services.js';
import type { CompetitionEvent } from '../../types/events.js';
import { log } from '../../utils/logger.js';

/**
 * In-memory event emitter for development and hackathon demos.
 * Uses Node.js EventEmitter for process-local pub/sub.
 *
 * For production with multiple instances, use RedisEventEmitter instead.
 */
export class MockEventEmitter implements IEventEmitter {
  private emitter = new EventEmitter();
  private static instance: MockEventEmitter | null = null;

  constructor() {
    // Increase max listeners since we may have many subscribers
    this.emitter.setMaxListeners(100);
  }

  /**
   * Get singleton instance (important for sharing events across services)
   */
  static getInstance(): MockEventEmitter {
    if (!MockEventEmitter.instance) {
      MockEventEmitter.instance = new MockEventEmitter();
    }
    return MockEventEmitter.instance;
  }

  /**
   * Emit an event to all subscribers
   */
  async emit(event: CompetitionEvent): Promise<void> {
    log('info', 'Events', `Emitting ${event.type} for competition ${event.competitionId}`);
    this.emitter.emit('competition-event', event);
  }

  /**
   * Subscribe to all competition events
   * Returns an unsubscribe function
   */
  subscribe(handler: (event: CompetitionEvent) => void): () => void {
    this.emitter.on('competition-event', handler);
    return () => {
      this.emitter.off('competition-event', handler);
    };
  }

  /**
   * Get count of current subscribers (useful for debugging)
   */
  getSubscriberCount(): number {
    return this.emitter.listenerCount('competition-event');
  }
}

export default MockEventEmitter;
