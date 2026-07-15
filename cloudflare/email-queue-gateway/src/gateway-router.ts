import { isJsonObject } from './contracts';

import type { EmailQueueGatewayEnv, JsonObject } from './contracts';

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim() || null;
}

export function withCorsHeaders(response: Response): Response {
  const next = new Response(response.body, response);
  next.headers.set('access-control-allow-origin', '*');
  next.headers.set('access-control-allow-headers', 'authorization, content-type');
  next.headers.set('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
  return next;
}

export async function readJson(request: Request): Promise<JsonObject | null> {
  try {
    const value: unknown = await request.json();
    return isJsonObject(value) ? value : null;
  } catch {
    return null;
  }
}

export function cloneRequest(request: Request, body: unknown): Request {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: body === undefined ? request.body : JSON.stringify(body),
  });
}

export async function routeGatewayRequest<Id>(
  request: Request,
  env: EmailQueueGatewayEnv<Id>,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return withCorsHeaders(new Response(null, { status: 204 }));
  }

  const url = new URL(request.url);
  if (url.pathname === '/health') {
    return withCorsHeaders(json({ ok: true, service: 'email-queue-gateway' }));
  }

  const token = getBearerToken(request);
  if (!env.GATEWAY_TOKEN || token !== env.GATEWAY_TOKEN) {
    return withCorsHeaders(json({ error: 'Unauthorized' }, { status: 401 }));
  }

  if (
    url.pathname === '/messages' ||
    url.pathname.startsWith('/messages/') ||
    url.pathname === '/status' ||
    url.pathname === '/drain'
  ) {
    const id = env.EMAIL_QUEUE_STATE.idFromName('primary');
    const stub = env.EMAIL_QUEUE_STATE.get(id);
    return stub.fetch(request);
  }

  if (url.pathname === '/rate-limit/consume' && request.method === 'POST') {
    const body = await readJson(request);
    const identifier = typeof body?.identifier === 'string' ? body.identifier : '';
    if (!identifier) {
      return withCorsHeaders(json({ error: 'Invalid rate limit payload' }, { status: 400 }));
    }

    const id = env.RATE_LIMIT_STATE.idFromName(identifier);
    const stub = env.RATE_LIMIT_STATE.get(id);
    return stub.fetch(cloneRequest(request, body));
  }

  if (
    (url.pathname === '/capacity/versions/bump' || url.pathname === '/capacity/versions/read') &&
    request.method === 'POST'
  ) {
    const id = env.CAPACITY_VERSION_STATE.idFromName('primary');
    const stub = env.CAPACITY_VERSION_STATE.get(id);
    return stub.fetch(request);
  }

  return withCorsHeaders(json({ error: 'Not found' }, { status: 404 }));
}
