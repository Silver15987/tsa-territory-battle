import { Server, Socket } from 'socket.io';
import { redisClient } from '../redisClient';
import { PlayerAction } from '../utils/types';

function getPlayerId(socket: Socket): string {
  // Use handshake auth or fallback to socket.id
  return socket.handshake.auth?.playerId || socket.id;
}

export function registerWebSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    const playerId = getPlayerId(socket);

    // Helper to queue an action
    async function queueAction(type: PlayerAction['type'], payload: any) {
      const action: PlayerAction = {
        type,
        payload,
        timestamp: Date.now(),
      };
      await redisClient.rpush(`player:${playerId}:actions`, JSON.stringify(action));
    }

    // Attack event
    socket.on('attack', (payload) => {
      // Minimal validation
      if (payload && typeof payload.x === 'number' && typeof payload.y === 'number') {
        queueAction('attack', payload);
      }
    });

    // Fortify event
    socket.on('fortify', (payload) => {
      if (payload && typeof payload.x === 'number' && typeof payload.y === 'number') {
        queueAction('fortify', payload);
      }
    });

    // Donate AP event
    socket.on('donate_ap', (payload) => {
      if (payload && typeof payload.amount === 'number') {
        queueAction('donate_ap', payload);
      }
    });

    // Upgrade request event
    socket.on('upgrade_request', (payload) => {
      if (payload && typeof payload.upgrade === 'string') {
        queueAction('upgrade_request', payload);
      }
    });
  });
} 