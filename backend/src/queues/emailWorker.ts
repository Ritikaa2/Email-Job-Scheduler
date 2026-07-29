import { Worker } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData } from './emailQueue';
import { processEmailJob } from '../jobs/emailProcessor';
import { redisClient } from '../services/rateLimiter';
import { config } from '../config/env';

export function setupWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processEmailJob(job);
    },
    {
      connection: redisClient,
      concurrency: config.workerConcurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log(`[Worker] Email Worker initialized with concurrency ${config.workerConcurrency}`);
  return worker;
}
