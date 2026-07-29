import { Queue } from 'bullmq';
import { redisClient } from '../services/rateLimiter';

export interface EmailJobData {
  emailJobId: string; // Idempotency key & DB row UUID
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledFor: string;
  maxEmailsPerHour?: number;
  minDelayBetweenEmailsMs?: number;
}

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: false, // Keep completed jobs so queue status can be checked
    removeOnFail: false,
  },
});
