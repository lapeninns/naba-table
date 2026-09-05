import { describe, expect, it, vi } from 'vitest';

import smsSummaryWorker from '@/cloudflare/sms-summary-gateway/src/index';

const TOKEN = 'sms-gateway-monitoring-token-with-thirty-two-chars';

function makeEnv(options: { withQueue?: boolean; withToken?: boolean; stateStatus?: number } = {}) {
  const send = vi.fn(async () => undefined);
  const seen: Request[] = [];
  const stateFetch = vi.fn(async (request: Request | string) => {
    const resolved = typeof request === 'string' ? new Request(request) : request;
    seen.push(resolved);
    return new Response(JSON.stringify({ ok: true }), { status: options.stateStatus ?? 200 });
  });
  const state = {
    idFromName: vi.fn((name: string) => `id:${name}`),
    get: vi.fn(() => ({ fetch: stateFetch })),
  };
  const base = {
    DAILY_BOOKING_SUMMARY_STATE: state,
    TWILIO_ACCOUNT_SID: 'ACtest',
    TWILIO_API_KEY_SID: 'SKtest',
    TWILIO_API_KEY_SECRET: 'secret',
    TWILIO_MESSAGING_SERVICE_SID: 'MGtest',
    TWILIO_WHATSAPP_SENDER: 'whatsapp:+10000000000',
    TWILIO_WHATSAPP_MANAGER_SUMMARY_CONTENT_SID: 'HXtest',
    SMS_SUMMARY_GATEWAY_PUBLIC_URL: 'https://sms.example.test',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    INTERNAL_TRIGGER_TOKEN: 'internal-trigger',
    DEPLOY_SHA: 'cafe1234',
    ...(options.withToken === false ? {} : { MONITORING_TOKEN: TOKEN }),
  };
  const env =
    options.withQueue === false
      ? (base as typeof base & { DAILY_BOOKING_SUMMARY_QUEUE: never })
      : { ...base, DAILY_BOOKING_SUMMARY_QUEUE: { send } };
  return { env, send, seen, state };
}

function ready(authorization?: string): Request {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  return new Request('https://sms.example.test/ready', { headers });
}

describe('sms-summary-gateway GET /ready', () => {
  it('keeps /health unauthenticated and unchanged', async () => {
    const { env } = makeEnv();
    const response = await smsSummaryWorker.fetch(
      new Request('https://sms.example.test/health'),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, service: 'sms-summary-gateway' });
  });

  it('rejects missing, wrong, and unconfigured tokens before touching bindings', async () => {
    const { env, seen, send } = makeEnv();
    for (const request of [ready(), ready('Bearer nope'), ready(`Bearer ${TOKEN}extra`)]) {
      const response = await smsSummaryWorker.fetch(request, env);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    }
    const unconfigured = makeEnv({ withToken: false });
    expect((await smsSummaryWorker.fetch(ready(`Bearer ${TOKEN}`), unconfigured.env)).status).toBe(
      401,
    );
    expect(seen).toEqual([]);
    expect(send).not.toHaveBeenCalled();
    expect(unconfigured.seen).toEqual([]);
  });

  it('checks queue binding presence and pings the Durable Object read-only', async () => {
    const { env, send, seen, state } = makeEnv();
    const response = await smsSummaryWorker.fetch(ready(`Bearer ${TOKEN}`), env);
    const body = (await response.json()) as {
      service: string;
      status: string;
      revision: string;
      checks: Array<{ name: string; status: string }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      service: 'sms-summary-gateway',
      status: 'ok',
      revision: 'cafe1234',
    });
    expect(body.checks.map((check) => [check.name, check.status])).toEqual([
      ['daily-summary-queue', 'ok'],
      ['daily-summary-state', 'ok'],
    ]);
    expect(send).not.toHaveBeenCalled();
    expect(state.idFromName).toHaveBeenCalledWith('readiness');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.method).toBe('GET');
    expect(new URL(seen[0]?.url ?? '').pathname).toBe('/status');
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it('returns 503 when the queue binding is missing or the Durable Object fails', async () => {
    const noQueue = makeEnv({ withQueue: false });
    const down = await smsSummaryWorker.fetch(ready(`Bearer ${TOKEN}`), noQueue.env);
    expect(down.status).toBe(503);
    await expect(down.json()).resolves.toMatchObject({
      status: 'down',
      checks: [
        { name: 'daily-summary-queue', status: 'down', detail: 'unconfigured' },
        { name: 'daily-summary-state', status: 'ok' },
      ],
    });

    const failingState = makeEnv({ stateStatus: 500 });
    const failed = await smsSummaryWorker.fetch(ready(`Bearer ${TOKEN}`), failingState.env);
    expect(failed.status).toBe(503);
    await expect(failed.json()).resolves.toMatchObject({
      checks: [
        { name: 'daily-summary-queue', status: 'ok' },
        { name: 'daily-summary-state', status: 'down', detail: 'http_500' },
      ],
    });
  });
});
