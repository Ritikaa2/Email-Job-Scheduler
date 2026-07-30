import { Worker } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData, registerMemoryProcessor } from './emailQueue';
import { processEmailJob } from '../jobs/emailProcessor';
import { redisClient, useMemoryQueue } from '../services/rateLimiter';
import { config } from '../config/env';

export function setupWorker(): Worker<EmailJobData> | { close: () => Promise<void> } {
  if (useMemoryQueue) {
    registerMemoryProcessor(async (job) => {
      await processEmailJob(job as any);
    });
    console.log(`[Worker] In-memory Email Worker initialized with concurrency 1`);
    return { close: async () => undefined };
  }

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: any) => {
      await processEmailJob(job);
    },
    {
      connection: redisClient!,
      concurrency: config.workerConcurrency,
    }
  );

  worker.on('completed', (job: any) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on('failed', (job: any, err: any) => {
    console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log(`[Worker] Email Worker initialized with concurrency ${config.workerConcurrency}`);
  return worker;
}
