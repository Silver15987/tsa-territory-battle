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
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import authRouter from './api/auth';

const app = express();

// Configure CORS to allow credentials
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Configure session middleware at app level
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
setSocketIO(io);

const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

registerAdminEndpoints(app);
registerWebSocketHandlers(io);
app.use('/auth', authRouter);

Promise.all([
  mongoClient.connect()
])
  .then(() => {
    log('All services connected.');
    startGameLoop();
    server.listen(PORT, () => {
      log(`🚀 Server running on port ${PORT}`);
      log(`📡 WebSocket server ready for connections`);
      log(`🌐 Accessible at: http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    error('Failed to connect to services:', err);
    process.exit(1);
  }); 