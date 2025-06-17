import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { redisClient } from './redisClient';
import { mongoClient } from './mongoClient';
import { registerWebSocketHandlers } from './api/websocket';
import { registerAdminEndpoints } from './api/admin';
import { startGameLoop, setSocketIO } from './gameLoop';
import { log, error } from './utils/logger';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
setSocketIO(io);

const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

registerAdminEndpoints(app);
registerWebSocketHandlers(io);

Promise.all([
  mongoClient.connect()
])
  .then(() => {
    log('All services connected.');
    startGameLoop();
    server.listen(PORT, () => {
      log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    error('Failed to connect to services:', err);
    process.exit(1);
  }); 