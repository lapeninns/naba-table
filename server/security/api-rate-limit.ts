import { NextResponse } from 'next/server';

import { recordSecurityEvent } from '@/server/security/events';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { anonymizeIp, extractClientIp } from '@/server/security/request';

import type { NextRequest } from 'next/server';

type ApiRateLimitParams = {
  request: NextRequest;
  scope: string;
  limit: number;
  windowMs: number;
  tenantId?: string | null;
  userId?: string | null;
  parts?: readonly (string | null | undefined)[];
  message?: string;
};

export async function requireApiRateLimit({
  request,
  scope,
  limit,
  windowMs,
  tenantId,
  userId,
  parts = [],
  message = 'Too many requests',
}: ApiRateLimitParams): Promise<NextResponse | null> {
  const clientIp = extractClientIp(request);
  const identifier = [
    'api',
    scope,
    tenantId ? `tenant:${tenantId}` : null,
    userId ? `user:${userId}` : null,
    `ip:${clientIp}`,
    ...parts,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(':');

  try {
    const result = await consumeRateLimit({ identifier, limit, windowMs });
    if (result.ok) {
      return null;
    }

    void recordSecurityEvent({
      eventType: 'rate_limit_exceeded',
      source: 'server.security.api-rate-limit',
      severity: 'warning',
      restaurantId: tenantId ?? null,
      context: {
        scope,
        userId,
        ipScope: anonymizeIp(clientIp),
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.resetAt,
      },
    });

    const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      {
        error: message,
        code: 'RATE_LIMITED',
        retryAfter: retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfterSeconds.toString(),
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetAt.toString(),
        },
      },
    );
  } catch (error) {
    console.error('[api][rate-limit] unavailable', {
      scope,
      tenantId,
      userId,
      ipScope: anonymizeIp(clientIp),
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Rate limit unavailable' }, { status: 503 });
  }
}
