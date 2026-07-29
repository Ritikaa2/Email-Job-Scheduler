import Redis from 'ioredis';
import { config } from '../config/env';

export const useMemoryQueue = config.redisUrl.trim().toLowerCase() === 'memory';

export const redisClient = useMemoryQueue
  ? null
  : new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });

const hourlyCounters = new Map<string, { count: number; expiresAt: number }>();
const senderSlots = new Map<string, number>();

export async function pingQueueStore(): Promise<string> {
  if (useMemoryQueue) return 'MEMORY';
  return redisClient!.ping();
}

export class RateLimiterService {
  /**
   * Checks and updates hourly rate limit per sender.
   * Returns true if within limit, false if limit exceeded.
   */
  static async checkAndIncrementHourlyLimit(senderId: string, maxPerHour: number): Promise<{ allowed: boolean; retryDelayMs?: number }> {
    const now = new Date();
    const dateHourStr = now.toISOString().substring(0, 13); // YYYY-MM-DDTHH
    const key = `rate:${senderId}:${dateHourStr}`;
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    const retryDelayMs = nextHour.getTime() - now.getTime();

    if (useMemoryQueue) {
      const existing = hourlyCounters.get(key);
      const current = existing && existing.expiresAt > now.getTime() ? existing.count : 0;

      if (current + 1 > maxPerHour) {
        return { allowed: false, retryDelayMs };
      }

      hourlyCounters.set(key, {
        count: current + 1,
        expiresAt: now.getTime() + retryDelayMs + 5000,
      });

      return { allowed: true, retryDelayMs };
    }

    const result = await redisClient!.eval(
      `
        local count = redis.call("INCR", KEYS[1])
        if count == 1 then
          redis.call("PEXPIRE", KEYS[1], ARGV[2] + 5000)
        end
        if count > tonumber(ARGV[1]) then
          redis.call("DECR", KEYS[1])
          return {0, ARGV[2]}
        end
        return {1, ARGV[2]}
      `,
      1,
      key,
      maxPerHour,
      retryDelayMs
    ) as [number, number];

    return {
      allowed: Number(result[0]) === 1,
      retryDelayMs: Number(result[1]),
    };
  }

  /**
   * Enforces minimum delay between emails for a sender.
   * If minimum delay has not elapsed, sleeps or returns remaining wait time.
   */
  static async enforceMinDelay(senderId: string, minDelayMs: number): Promise<void> {
    const now = Date.now();
    const key = `send_slot:${senderId}`;

    if (useMemoryQueue) {
      const previousSlot = senderSlots.get(key) || 0;
      const nextSlot = previousSlot + minDelayMs > now ? previousSlot + minDelayMs : now;
      const waitTime = nextSlot - now;
      senderSlots.set(key, nextSlot);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      return;
    }

    const waitTime = await redisClient!.eval(
      `
        local now = tonumber(ARGV[1])
        local minDelay = tonumber(ARGV[2])
        local ttl = tonumber(ARGV[3])
        local previousSlot = tonumber(redis.call("GET", KEYS[1]) or "0")
        local nextSlot = now

        if previousSlot + minDelay > now then
          nextSlot = previousSlot + minDelay
        end

        redis.call("SET", KEYS[1], tostring(nextSlot), "PX", ttl)
        return nextSlot - now
      `,
      1,
      key,
      now,
      minDelayMs,
      24 * 60 * 60 * 1000
    ) as number;

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}
