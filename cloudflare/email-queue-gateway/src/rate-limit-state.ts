import { DurableObject } from 'cloudflare:workers';

import { json, readJson, withCorsHeaders } from './gateway-router';

import type { EmailQueueGatewayEnv } from './contracts';

export class RateLimitState extends DurableObject<EmailQueueGatewayEnv> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/rate-limit/consume' || request.method !== 'POST') {
      return withCorsHeaders(json({ error: 'Not found' }, { status: 404 }));
    }

    const body = await readJson(request);
    if (
      !body ||
      typeof body.identifier !== 'string' ||
      typeof body.limit !== 'number' ||
      typeof body.windowMs !== 'number'
    ) {
      return withCorsHeaders(json({ error: 'Invalid rate limit payload' }, { status: 400 }));
    }

    const now = Date.now();
    const windowMs = Math.max(1, Math.floor(body.windowMs));
    const limit = Math.max(1, Math.floor(body.limit));
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;
    const current = await this.ctx.storage.get<{ count: number; windowStart: number }>('bucket');

    let count = 1;
    if (current && current.windowStart === windowStart && typeof current.count === 'number') {
      count = Math.max(0, Math.floor(current.count)) + 1;
    }

    await this.ctx.storage.put('bucket', { windowStart, count, resetAt });

    return withCorsHeaders(
      json({
        ok: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        resetAt,
        source: 'cloudflare',
      }),
    );
  }
}
