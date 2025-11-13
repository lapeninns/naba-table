import { randomUUID } from "node:crypto";

import { getRedisConnection } from "@/lib/queue/redis";

import type IORedis from "ioredis";


export type DistributedLock = {
  id: string;
  resourceId: string;
  ttlMs: number;
  acquiredAt: number;
  release(): Promise<boolean>;
  extend(additionalTtlMs: number): Promise<boolean>;
};

export class DistributedLockManager {
  constructor(private readonly redis: IORedis = getRedisConnection()) {}

  async acquireLock(resourceId: string, ttlMs = 30_000): Promise<DistributedLock | null> {
    if (!resourceId) {
      throw new Error("resourceId is required to acquire a lock");
    }
    const key = this.buildKey(resourceId);
    const lockId = randomUUID();
    const acquired = await this.redis.set(key, lockId, "PX", ttlMs, "NX");
    if (acquired !== "OK") {
      return null;
    }

    const acquireTime = Date.now();
    const release = async (): Promise<boolean> => {
      const result = await this.redis.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then
           return redis.call("del", KEYS[1])
         else
           return 0
         end`,
        1,
        key,
        lockId,
      );
      return result === 1;
    };

    const extend = async (additionalTtlMs: number): Promise<boolean> => {
      if (additionalTtlMs <= 0) {
        return false;
      }
      const result = await this.redis.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then
           return redis.call("pexpire", KEYS[1], ARGV[2])
         else
           return 0
         end`,
        1,
        key,
        lockId,
        String(additionalTtlMs),
      );
      return result === 1;
    };

    return {
      id: lockId,
      resourceId,
      ttlMs,
      acquiredAt: acquireTime,
      release,
      extend,
    };
  }

  private buildKey(resourceId: string): string {
    return `lock:${resourceId}`;
  }
}
