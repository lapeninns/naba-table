import { DurableObject } from 'cloudflare:workers';

import { readCapacityVersions } from './capacity-versions';
import { json, readJson, withCorsHeaders } from './gateway-router';

import type { EmailQueueGatewayEnv } from './contracts';

export class CapacityVersionState extends DurableObject<EmailQueueGatewayEnv> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/capacity/versions/bump' && request.method === 'POST') {
      return withCorsHeaders(await this.handleBump(request));
    }
    if (url.pathname === '/capacity/versions/read' && request.method === 'POST') {
      return withCorsHeaders(await this.handleRead(request));
    }
    return withCorsHeaders(json({ error: 'Not found' }, { status: 404 }));
  }

  async handleBump(request: Request): Promise<Response> {
    const body = await readJson(request);
    const restaurantId = typeof body?.restaurantId === 'string' ? body.restaurantId.trim() : '';
    const kind = body?.kind === 'adj' ? 'adj' : body?.kind === 'inv' ? 'inv' : null;

    if (!restaurantId || !kind) {
      return json({ error: 'Invalid capacity version bump payload' }, { status: 400 });
    }

    const key = `${kind}:${restaurantId}`;
    const current = await this.ctx.storage.get(key);
    const nextVersion =
      typeof current === 'number' && Number.isFinite(current) ? Math.floor(current) + 1 : 1;
    await this.ctx.storage.put(key, nextVersion);

    return json({ ok: true, restaurantId, kind, version: nextVersion });
  }

  async handleRead(request: Request): Promise<Response> {
    const body = await readJson(request);
    const restaurantIds = Array.isArray(body?.restaurantIds)
      ? body.restaurantIds.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    const versions = await readCapacityVersions(this.ctx.storage, restaurantIds);
    return json({ ok: true, versions });
  }
}
