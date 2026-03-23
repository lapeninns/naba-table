import { env } from '@/lib/env';
import {
  extractCloudflareGatewayError,
  isCloudflareGatewayConfigured,
  requestCloudflareGateway,
} from '@/server/cloudflare/gateway';

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
  source: 'cloudflare' | 'memory' | 'none';
};

type MemoryBucket = {
  count: number;
  resetAt: number;
};

class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitConfigurationError';
  }
}

const memoryStore = new Map<string, MemoryBucket>();
let warnedAboutMemoryStore = false;
let warnedAboutMissingGateway = false;
const devMode = env.node.env === 'development';
const isProductionEnv = env.node.env === 'production';

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (/^(true|1|yes)$/i.test(value.trim())) return true;
  if (/^(false|0|no)$/i.test(value.trim())) return false;
  return undefined;
}

const enableRateLimitInDev = parseBooleanEnv(process.env.ENABLE_RATE_LIMIT_IN_DEV);
const shouldBypassRateLimit = devMode && enableRateLimitInDev !== true;

function logMissingCloudflareWarning() {
  if (shouldBypassRateLimit) {
    return;
  }
  if (warnedAboutMissingGateway) {
    return;
  }

  if (isProductionEnv) {
    warnedAboutMissingGateway = true;
    throw new RateLimitConfigurationError(
      'Cloudflare gateway credentials (CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL/CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN) are required in production.',
    );
  }

  console.warn(
    '[rate-limit] Cloudflare gateway credentials are missing. Falling back to in-memory limiter for this session.',
  );
  warnedAboutMissingGateway = true;
}

function assertMemoryFallbackAllowed(): void {
  if (isProductionEnv && !shouldBypassRateLimit) {
    throw new RateLimitConfigurationError("In-memory rate limiting is not permitted in production.");
  }
}

function now(): number {
  return Date.now();
}

function memoryStoreRateLimit(params: RateLimitParams): RateLimitResult {
  assertMemoryFallbackAllowed();
  if (shouldBypassRateLimit) {
    const resetAt = now() + params.windowMs;
    return {
      ok: true,
      limit: params.limit,
      remaining: params.limit,
      resetAt,
      source: 'none',
    };
  }

  if (!warnedAboutMemoryStore) {
    console.warn('[rate-limit] Falling back to in-memory rate limiter. Configure the Cloudflare gateway for multi-instance safety.');
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
      source: 'memory',
    };
  }

  const nextCount = existing.count + 1;
  existing.count = nextCount;

  return {
    ok: nextCount <= params.limit,
    limit: params.limit,
    remaining: Math.max(0, params.limit - nextCount),
    resetAt: existing.resetAt,
    source: 'memory',
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
      source: 'none',
    };
  }

  if (!isCloudflareGatewayConfigured()) {
    logMissingCloudflareWarning();
    return memoryStoreRateLimit(params);
  }

  try {
    const { response, body } = await requestCloudflareGateway<RateLimitResult>('/rate-limit/consume', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (!response.ok || !body) {
      throw new Error(
        extractCloudflareGatewayError(
          body,
          `Cloudflare rate limit request failed with status ${response.status}`,
        ),
      );
    }

    return body;
  } catch (error) {
    console.error('[rate-limit] cloudflare request failed', error);
    return memoryStoreRateLimit(params);
  }
}
