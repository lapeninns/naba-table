import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";

type RateLimitParams = {
  identifier: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  source: "redis" | "memory" | "none";
};

type MemoryBucket = {
  count: number;
  resetAt: number;
};

let redisClient: Redis | null | undefined;
const memoryStore = new Map<string, MemoryBucket>();
let warnedAboutMemoryStore = false;
let warnedAboutMissingUpstash = false;
const devMode = env.node.env === "development";

const parseBooleanEnv = (value: string | undefined): boolean | undefined => {
  if (!value) return undefined;
  if (/^(true|1|yes)$/i.test(value.trim())) return true;
  if (/^(false|0|no)$/i.test(value.trim())) return false;
  return undefined;
};

const enableRateLimitInDev = parseBooleanEnv(process.env.ENABLE_RATE_LIMIT_IN_DEV);
const shouldBypassRateLimit = devMode && enableRateLimitInDev !== true;

function logMissingUpstashWarning() {
  if (shouldBypassRateLimit) {
    return;
  }
  if (warnedAboutMissingUpstash) {
    return;
  }
  const envName = process.env.NODE_ENV ?? "development";
  if (envName === "production") {
    warnedAboutMissingUpstash = true;
    return;
  }

  console.warn(
    "[rate-limit] Upstash Redis credentials (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) are missing. Falling back to in-memory limiter for this session.",
  );
  warnedAboutMissingUpstash = true;
}

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  try {
    const { restUrl, restToken } = env.cache.upstash;
    if (restUrl && restToken) {
      redisClient = new Redis({
        url: restUrl,
        token: restToken,
      });
      return redisClient;
    }
    logMissingUpstashWarning();
  } catch (error) {
    console.warn("[rate-limit] unable to initialize Upstash client, falling back to in-memory store", error instanceof Error ? error.message : error);
  }

  redisClient = null;
  return redisClient;
}

function now(): number {
  return Date.now();
}

function useMemoryStore(params: RateLimitParams): RateLimitResult {
  if (shouldBypassRateLimit) {
    const resetAt = now() + params.windowMs;
    return {
      ok: true,
      limit: params.limit,
      remaining: params.limit,
      resetAt,
      source: "none",
    };
  }

  if (!warnedAboutMemoryStore) {
    console.warn("[rate-limit] Falling back to in-memory rate limiter. Configure Upstash Redis for multi-instance safety.");
    warnedAboutMemoryStore = true;
  }

  const current = now();
  const key = params.identifier;
  const existing = memoryStore.get(key);

  if (!existing || existing.resetAt <= current) {
    const resetAt = current + params.windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      ok: true,
      limit: params.limit,
      remaining: params.limit - 1,
      resetAt,
      source: "memory",
    };
  }

  const nextCount = existing.count + 1;
  existing.count = nextCount;

  return {
    ok: nextCount <= params.limit,
    limit: params.limit,
    remaining: Math.max(0, params.limit - nextCount),
    resetAt: existing.resetAt,
    source: "memory",
  };
}

export async function consumeRateLimit(params: RateLimitParams): Promise<RateLimitResult> {
  if (shouldBypassRateLimit) {
    const resetAt = now() + params.windowMs;
    return {
      ok: true,
      limit: params.limit,
      remaining: params.limit,
      resetAt,
      source: "none",
    };
  }

  const redis = getRedisClient();
  if (!redis) {
    return useMemoryStore(params);
  }

  const current = now();
  const windowStart = Math.floor(current / params.windowMs) * params.windowMs;
  const resetAt = windowStart + params.windowMs;
  const redisKey = `rl:${params.identifier}:${windowStart}`;

  try {
    const countResult = await redis.incr(redisKey);
    const count = typeof countResult === "number" ? countResult : Number(countResult ?? 0);

    if (Number.isNaN(count)) {
      console.error("[rate-limit] redis incr returned non-numeric value", countResult);
      return useMemoryStore(params);
    }

    if (count === 1) {
      try {
        await redis.pexpire(redisKey, params.windowMs);
      } catch (expireError) {
        console.warn("[rate-limit] failed to set redis TTL", expireError);
      }
    }

    const remaining = Math.max(0, params.limit - count);

    return {
      ok: count <= params.limit,
      limit: params.limit,
      remaining,
      resetAt,
      source: "redis",
    };
  } catch (error) {
    console.error("[rate-limit] redis pipeline failed", error);
    return useMemoryStore(params);
  }
}
