import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config/env';
import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { emailQueue } from './queues/emailQueue';
import { useMemoryQueue } from './services/rateLimiter';

export const app = express();

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (useMemoryQueue) {
  app.use('/admin/queues', (req, res) => {
    res.status(503).send('Bull Board requires Redis-backed BullMQ. Set REDIS_URL to a Redis connection string to use this dashboard.');
  });
} else {
  const bullBoardServerAdapter = new ExpressAdapter();
  bullBoardServerAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue as Queue)],
    serverAdapter: bullBoardServerAdapter,
  });

  app.use('/admin/queues', bullBoardServerAdapter.getRouter());
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Error Handler
app.use(errorHandler);
