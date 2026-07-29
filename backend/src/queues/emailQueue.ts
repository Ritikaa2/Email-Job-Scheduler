import { Queue } from 'bullmq';
import { redisClient, useMemoryQueue } from '../services/rateLimiter';

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

type JobState = 'waiting' | 'delayed' | 'active' | 'completed' | 'failed' | 'paused';
type Processor = (job: MemoryJob<EmailJobData>) => Promise<void>;

export interface MemoryJob<T> {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  opts: {
    attempts?: number;
    delay?: number;
    jobId?: string;
  };
}

class MemoryEmailQueue {
  private jobs = new Map<string, MemoryJob<EmailJobData> & { state: JobState; timer?: NodeJS.Timeout }>();
  private processor: Processor | null = null;

  async waitUntilReady() {
    return;
  }

  setProcessor(processor: Processor) {
    this.processor = processor;
    for (const job of this.jobs.values()) {
      if (job.state === 'waiting' || job.state === 'delayed') {
        this.schedule(job);
      }
    }
  }

  async add(name: string, data: EmailJobData, opts: { delay?: number; jobId?: string } = {}) {
    const id = opts.jobId || `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const delay = Math.max(0, opts.delay || 0);
    const job = {
      id,
      name,
      data,
      attemptsMade: 0,
      opts: {
        attempts: 3,
        delay,
        jobId: id,
      },
      state: delay > 0 ? 'delayed' as JobState : 'waiting' as JobState,
    };

    this.jobs.set(id, job);
    this.schedule(job);
    return job;
  }

  async getJobCounts(...states: JobState[]) {
    const requestedStates = states.length ? states : ['waiting', 'delayed', 'active', 'completed', 'failed', 'paused'];
    const counts: Record<string, number> = {};
    for (const state of requestedStates) counts[state] = 0;

    for (const job of this.jobs.values()) {
      if (job.state in counts) counts[job.state] += 1;
    }

    return counts;
  }

  async getJobs(states: JobState[]) {
    return Array.from(this.jobs.values()).filter((job) => states.includes(job.state));
  }

  async getJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      ...job,
      remove: async () => {
        const currentJob = this.jobs.get(jobId);
        if (!currentJob) return;

        if (currentJob.state === 'active') {
          throw new Error('This email is already being sent and cannot be cancelled.');
        }

        if (currentJob.timer) {
          clearTimeout(currentJob.timer);
        }

        this.jobs.delete(jobId);
      },
    };
  }

  private schedule(job: MemoryJob<EmailJobData> & { state: JobState; timer?: NodeJS.Timeout }) {
    if (!this.processor || job.timer || job.state === 'active' || job.state === 'completed' || job.state === 'failed') {
      return;
    }

    const delay = Math.max(0, job.opts.delay || 0);
    job.timer = setTimeout(() => this.run(job.id), delay);
  }

  private async run(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || !this.processor) return;

    job.timer = undefined;
    job.opts.delay = 0;
    job.state = 'active';

    try {
      await this.processor(job);
      job.state = 'completed';
    } catch (error: any) {
      job.attemptsMade += 1;
      if (job.attemptsMade < (job.opts.attempts || 3)) {
        job.state = 'waiting';
        job.opts.delay = Math.min(30000, 1000 * 2 ** (job.attemptsMade - 1));
        this.schedule(job);
        return;
      }

      job.state = 'failed';
      console.error(`[MemoryQueue] Job ${job.id} failed:`, error?.message || error);
    }
  }
}

export const emailQueue = useMemoryQueue
  ? new MemoryEmailQueue()
  : new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: redisClient!,
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

export function registerMemoryProcessor(processor: Processor) {
  if (useMemoryQueue && 'setProcessor' in emailQueue) {
    emailQueue.setProcessor(processor);
  }
}
