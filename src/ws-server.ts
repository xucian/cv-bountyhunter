/**
 * Standalone WebSocket server for real-time competition updates.
 *
 * - Runs on port 4000 (or WS_PORT env var)
 * - Clients subscribe to specific competition IDs
 * - Broadcasts events from CompetitionRunner to connected clients
 *
 * Usage:
 *   bun run ws      # or: npx tsx src/ws-server.ts
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServices } from './services/index.js';
import type { CompetitionEvent, WSClientMessage } from './types/events.js';
import { log } from './utils/logger.js';
import { enableFileLogging } from './utils/logger.js';

// Enable file logging
enableFileLogging();

const PORT = Number(process.env.WS_PORT) || 4000;

// Room management: competitionId -> Set of connected WebSocket clients
const rooms = new Map<string, Set<WebSocket>>();

// Track which rooms each client is subscribed to (for cleanup on disconnect)
const clientRooms = new Map<WebSocket, Set<string>>();

// Create services (to get event emitter)
const services = createServices();

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

log('info', 'WS', `WebSocket server starting on port ${PORT}...`);

wss.on('connection', (ws) => {
  log('info', 'WS', `Client connected (total: ${wss.clients.size})`);
  clientRooms.set(ws, new Set());

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as WSClientMessage;

      switch (message.type) {
        case 'subscribe': {
          const { competitionId } = message;
          log('info', 'WS', `Client subscribing to competition ${competitionId}`);

          // Add client to room
          if (!rooms.has(competitionId)) {
            rooms.set(competitionId, new Set());
          }
          rooms.get(competitionId)!.add(ws);
          clientRooms.get(ws)!.add(competitionId);

          // Send current competition state immediately (if exists)
          try {
            const competition = await services.state.getCompetition(competitionId);
            if (competition) {
              const syncEvent: CompetitionEvent = {
                type: 'competition:sync',
                competitionId,
                timestamp: Date.now(),
                payload: { competition },
              };
              ws.send(JSON.stringify(syncEvent));
            }
          } catch (err) {
            log('error', 'WS', `Failed to get competition ${competitionId}: ${err}`);
          }
          break;
        }

        case 'unsubscribe': {
          const { competitionId } = message;
          log('info', 'WS', `Client unsubscribing from competition ${competitionId}`);

          rooms.get(competitionId)?.delete(ws);
          clientRooms.get(ws)?.delete(competitionId);

          // Clean up empty rooms
          if (rooms.get(competitionId)?.size === 0) {
            rooms.delete(competitionId);
          }
          break;
        }

        default:
          log('warn', 'WS', `Unknown message type: ${(message as any).type}`);
      }
    } catch (err) {
      log('error', 'WS', `Failed to parse message: ${err}`);
    }
  });

  ws.on('close', () => {
    // Clean up all room subscriptions for this client
    const subscribedRooms = clientRooms.get(ws);
    if (subscribedRooms) {
      for (const roomId of subscribedRooms) {
        rooms.get(roomId)?.delete(ws);
        // Clean up empty rooms
        if (rooms.get(roomId)?.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
    clientRooms.delete(ws);
    log('info', 'WS', `Client disconnected (total: ${wss.clients.size})`);
  });

  ws.on('error', (error) => {
    log('error', 'WS', `WebSocket error: ${error}`);
  });
});

/**
 * Broadcast an event to all clients watching a specific competition
 */
function broadcast(competitionId: string, event: CompetitionEvent): void {
  const clients = rooms.get(competitionId);
  if (!clients || clients.size === 0) {
    return;
  }

  const message = JSON.stringify(event);
  let sent = 0;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  }

  log('info', 'WS', `Broadcast ${event.type} to ${sent} clients for competition ${competitionId}`);
}

// Subscribe to events from CompetitionRunner
services.events.subscribe((event) => {
  broadcast(event.competitionId, event);
});

console.log(`
╔════════════════════════════════════════════════╗
║     CodeBounty WebSocket Server                ║
║     Listening on ws://localhost:${PORT}          ║
╚════════════════════════════════════════════════╝
`);

log('info', 'WS', `WebSocket server running on port ${PORT}`);

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('info', 'WS', 'Shutting down...');
  wss.close(() => {
    log('info', 'WS', 'WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log('info', 'WS', 'Shutting down...');
  wss.close(() => {
    log('info', 'WS', 'WebSocket server closed');
    process.exit(0);
  });
});
