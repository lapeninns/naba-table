import { describe, expect, it, vi } from 'vitest';

// The Durable Object classes re-exported by the Worker entrypoint extend the
// runtime-only `cloudflare:workers` base class, which Vite cannot resolve in
// the root test environment. The readiness path never instantiates them, so
// bare stand-ins are enough to load the Worker module.
vi.mock('@/cloudflare/email-queue-gateway/src/email-queue-state', () => ({
  EmailQueueState: class {},
}));
vi.mock('@/cloudflare/email-queue-gateway/src/capacity-version-state', () => ({
  CapacityVersionState: class {},
}));
vi.mock('@/cloudflare/email-queue-gateway/src/rate-limit-state', () => ({
  RateLimitState: class {},
}));

import emailQueueGatewayWorker from '@/cloudflare/email-queue-gateway/src/index';

type WorkerEnv = Parameters<typeof emailQueueGatewayWorker.fetch>[1];
type Binding = WorkerEnv['EMAIL_QUEUE_STATE'];
type BindingId = ReturnType<Binding['idFromName']>;

const TOKEN = 'email-gateway-monitoring-token-thirty-two-plus-chars';

function createBinding(status = 200): { binding: Binding; seen: Request[] } {
  const seen: Request[] = [];
  const binding: Binding = {
    idFromName: (name: string) => name as unknown as BindingId,
    get: () => ({
      fetch: async (request: Request) => {
        seen.push(request);
        return new Response(JSON.stringify({ ok: true }), { status });
      },
    }),
  };
  return { binding, seen };
}

function makeEnv(
  options: { withToken?: boolean; queueStatus?: number; capacityStatus?: number } = {},
) {
  const queue = createBinding(options.queueStatus);
  const capacity = createBinding(options.capacityStatus);
  const rateLimit = createBinding();
  const env: WorkerEnv = {
    APP_PROCESS_EMAILS_TOKEN: 'app-process-token',
    APP_PROCESS_EMAILS_URL: 'https://app.example.test/api/queue/email/process',
    CAPACITY_VERSION_STATE: capacity.binding,
    EMAIL_QUEUE_STATE: queue.binding,
    GATEWAY_TOKEN: 'gateway-token',
    RATE_LIMIT_STATE: rateLimit.binding,
    DEPLOY_SHA: 'feed1234',
    ...(options.withToken === false ? {} : { MONITORING_TOKEN: TOKEN }),
  };
  return { env, queue, capacity, rateLimit };
}

function ready(authorization?: string): Request {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  return new Request('https://email-queue-gateway.example.test/ready', { headers });
}

describe('email-queue-gateway GET /ready', () => {
  it('keeps /health unauthenticated and unchanged', async () => {
    const { env } = makeEnv();
    const response = await emailQueueGatewayWorker.fetch(
      new Request('https://email-queue-gateway.example.test/health'),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, service: 'email-queue-gateway' });
  });

  it('rejects missing, wrong, and unconfigured tokens before touching any Durable Object', async () => {
    const { env, queue, capacity } = makeEnv();
    for (const request of [ready(), ready('Bearer gateway-token'), ready(`Bearer ${TOKEN}x`)]) {
      const response = await emailQueueGatewayWorker.fetch(request, env);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    const unconfigured = makeEnv({ withToken: false });
    expect(
      (await emailQueueGatewayWorker.fetch(ready(`Bearer ${TOKEN}`), unconfigured.env)).status,
    ).toBe(401);
    expect(queue.seen).toEqual([]);
    expect(capacity.seen).toEqual([]);
    expect(unconfigured.queue.seen).toEqual([]);
  });

  it('pings both state objects with read-only GETs and reports revision', async () => {
    const { env, queue, capacity, rateLimit } = makeEnv();
    const response = await emailQueueGatewayWorker.fetch(ready(`Bearer ${TOKEN}`), env);
    const body = (await response.json()) as {
      service: string;
      status: string;
      revision: string;
      checks: Array<{ name: string; status: string }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      service: 'email-queue-gateway',
      status: 'ok',
      revision: 'feed1234',
    });
    expect(body.checks.map((check) => [check.name, check.status])).toEqual([
      ['email-queue-state', 'ok'],
      ['capacity-version-state', 'ok'],
    ]);
    for (const seen of [queue.seen, capacity.seen]) {
      expect(seen).toHaveLength(1);
      expect(seen[0]?.method).toBe('GET');
      expect(new URL(seen[0]?.url ?? '').pathname).toBe('/health');
    }
    expect(rateLimit.seen).toEqual([]);
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(JSON.stringify(body)).not.toContain('gateway-token');
  });

  it('returns 503 when a state object answers 5xx', async () => {
    const { env } = makeEnv({ queueStatus: 503 });
    const response = await emailQueueGatewayWorker.fetch(ready(`Bearer ${TOKEN}`), env);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'down',
      checks: [
        { name: 'email-queue-state', status: 'down', detail: 'http_503' },
        { name: 'capacity-version-state', status: 'ok' },
      ],
    });
  });
});
