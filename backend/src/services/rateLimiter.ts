import Redis from 'ioredis';
import { config } from '../config/env';

export const redisClient = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

export class RateLimiterService {
  /**
   * Checks and updates hourly rate limit per sender.
   * Returns true if within limit, false if limit exceeded.
   */
  static async checkAndIncrementHourlyLimit(senderId: string, maxPerHour: number): Promise<{ allowed: boolean; retryDelayMs?: number }> {
    const now = new Date();
    const dateHourStr = now.toISOString().substring(0, 13); // YYYY-MM-DDTHH
    const key = `rate:${senderId}:${dateHourStr}`;

    const count = await redisClient.incr(key);
    if (count === 1) {
      // Set TTL to 3600 seconds (1 hour)
      await redisClient.expire(key, 3600);
    }

    if (count > maxPerHour) {
      // Calculate milliseconds until the next hour
      const nextHour = new Date(now);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const retryDelayMs = nextHour.getTime() - now.getTime();
      return { allowed: false, retryDelayMs };
    }

    return { allowed: true };
  }

  /**
   * Enforces minimum delay between emails for a sender.
   * If minimum delay has not elapsed, sleeps or returns remaining wait time.
   */
  static async enforceMinDelay(senderId: string, minDelayMs: number): Promise<void> {
    const key = `last_sent:${senderId}`;
    const lastSent = await redisClient.get(key);
    const now = Date.now();

    if (lastSent) {
      const elapsed = now - parseInt(lastSent, 10);
      if (elapsed < minDelayMs) {
        const waitTime = minDelayMs - elapsed;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    await redisClient.set(key, Date.now().toString(), 'PX', 86400000); // 24h expiration
  }
}
