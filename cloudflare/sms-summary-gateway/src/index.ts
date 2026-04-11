import {
  buildDailySummaryPreview,
  getRestaurantDailySummaryTarget,
  listRestaurantDailySummaryTargets,
} from './supabase';
import { IDEMPOTENCY_LOCK_MS, SENT_RETENTION_DAYS, SERVICE_NAME } from './contracts';
import { processDailySummaryDispatch, sendDailySummaryViaTwilio } from './job';
import { resolveDueDispatch, selectDueDispatches } from './scheduling';
import { TerminalDispatchError } from './twilio';

import type { DailySummaryQueueMessage } from './contracts';

type WorkerEnv = {
  DAILY_BOOKING_SUMMARY_QUEUE: {
    send: (message: DailySummaryQueueMessage) => Promise<void>;
  };
  DAILY_BOOKING_SUMMARY_STATE: {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => {
      fetch: (request: Request | string, init?: RequestInit) => Promise<Response>;
    };
  };
  TWILIO_ACCOUNT_SID: string;
  TWILIO_API_KEY_SID: string;
  TWILIO_API_KEY_SECRET: string;
  TWILIO_MESSAGING_SERVICE_SID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  INTERNAL_TRIGGER_TOKEN: string;
};

type DurableState = {
  sentAt: string | null;
  providerMessageId: string | null;
  lockUntil: string | null;
  expiresAt: string | null;
};

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');

  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim() || null;
}

function isAuthorized(request: Request, expectedToken: string): boolean {
  return Boolean(expectedToken) && getBearerToken(request) === expectedToken;
}

function isValidLocalDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildIdempotencyName(payload: DailySummaryQueueMessage): string {
  return `daily-booking-summary:${payload.restaurantId}:${payload.localDate}:${payload.recipient}`;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function requestIdempotency(
  env: WorkerEnv,
  payload: DailySummaryQueueMessage,
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown> | null> {
  const id = env.DAILY_BOOKING_SUMMARY_STATE.idFromName(buildIdempotencyName(payload));
  const stub = env.DAILY_BOOKING_SUMMARY_STATE.get(id);
  const response = await stub.fetch(`https://state${path}`, init);
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

function getQueueMessageAck(message: { ack?: () => void }): void {
  message.ack?.();
}

function getQueueMessageRetry(message: { retry?: () => void }): void {
  message.retry?.();
}

export class DailyBookingSummaryState {
  ctx: any;

  constructor(ctx: any) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/claim' && request.method === 'POST') {
      return this.handleClaim();
    }

    if (url.pathname === '/complete' && request.method === 'POST') {
      const body = await readJson(request);
      return this.handleComplete(body);
    }

    if (url.pathname === '/release' && request.method === 'POST') {
      return this.handleRelease();
    }

    if (url.pathname === '/status' && request.method === 'GET') {
      return this.handleStatus();
    }

    if (url.pathname === '/reset' && request.method === 'POST') {
      return this.handleReset();
    }

    return json({ error: 'Not found' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  async readState(): Promise<DurableState> {
    return (
      ((await this.ctx.storage.get('state')) as DurableState | undefined) ?? {
        sentAt: null,
        providerMessageId: null,
        lockUntil: null,
        expiresAt: null,
      }
    );
  }

  async writeState(state: DurableState): Promise<void> {
    await this.ctx.storage.put('state', state);
  }

  async handleClaim(): Promise<Response> {
    const state = await this.readState();
    const now = Date.now();
    const lockUntilMs = state.lockUntil ? Date.parse(state.lockUntil) : Number.NaN;

    if (state.sentAt) {
      return json({
        status: 'already_sent',
        providerMessageId: state.providerMessageId,
        sentAt: state.sentAt,
      });
    }

    if (Number.isFinite(lockUntilMs) && lockUntilMs > now) {
      return json({
        status: 'locked',
        lockUntil: state.lockUntil,
      });
    }

    const nextState: DurableState = {
      ...state,
      lockUntil: new Date(now + IDEMPOTENCY_LOCK_MS).toISOString(),
    };

    await this.writeState(nextState);

    return json({ status: 'claimed' });
  }

  async handleComplete(body: Record<string, unknown> | null): Promise<Response> {
    const providerMessageId =
      typeof body?.providerMessageId === 'string' && body.providerMessageId.trim().length > 0
        ? body.providerMessageId
        : null;
    const sentAt = new Date().toISOString();
    const retentionMs = SENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    await this.writeState({
      sentAt,
      providerMessageId,
      lockUntil: null,
      expiresAt: new Date(Date.now() + retentionMs).toISOString(),
    });
    await this.ctx.storage.setAlarm(Date.now() + retentionMs);

    return json({ status: 'sent', sentAt, providerMessageId });
  }

  async handleRelease(): Promise<Response> {
    const state = await this.readState();
    await this.writeState({
      ...state,
      lockUntil: null,
    });

    return json({ status: 'released' });
  }

  async handleStatus(): Promise<Response> {
    const state = await this.readState();
    return json({
      status: state.sentAt ? 'sent' : state.lockUntil ? 'locked' : 'idle',
      sentAt: state.sentAt,
      providerMessageId: state.providerMessageId,
      lockUntil: state.lockUntil,
      expiresAt: state.expiresAt,
    });
  }

  async handleReset(): Promise<Response> {
    await this.ctx.storage.deleteAll();
    return json({ status: 'reset' });
  }
}

async function getIdempotencyClient(env: WorkerEnv, payload: DailySummaryQueueMessage) {
  return {
    claim: async () => {
      const body = await requestIdempotency(env, payload, '/claim', { method: 'POST' });
      return (body ?? { status: 'claimed' }) as
        | { status: 'claimed' }
        | { status: 'already_sent'; providerMessageId: string | null; sentAt: string | null }
        | { status: 'locked'; lockUntil: string | null };
    },
    markSent: async (providerMessageId: string | null) => {
      await requestIdempotency(env, payload, '/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerMessageId }),
      });
    },
    release: async () => {
      await requestIdempotency(env, payload, '/release', { method: 'POST' });
    },
    reset: async () => {
      await requestIdempotency(env, payload, '/reset', { method: 'POST' });
    },
    status: async () => {
      return requestIdempotency(env, payload, '/status');
    },
  };
}

async function handleManualDispatch(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isAuthorized(request, env.INTERNAL_TRIGGER_TOKEN)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJson(request);
  const restaurantId = typeof body?.restaurantId === 'string' ? body.restaurantId.trim() : '';
  const requestedDate = body?.date;
  const dryRun = body?.dryRun !== false;
  const force = body?.force === true;

  if (!restaurantId) {
    return json({ error: 'restaurantId is required' }, { status: 400 });
  }

  if (requestedDate !== undefined && !isValidLocalDate(requestedDate)) {
    return json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const target = await getRestaurantDailySummaryTarget(env, restaurantId);

  if (!target) {
    return json({ error: 'Restaurant daily SMS summary target not found' }, { status: 404 });
  }

  if (!target.enabled) {
    return json({ error: 'Restaurant daily SMS summary is disabled' }, { status: 409 });
  }

  const dueDispatch = resolveDueDispatch({
    now: new Date(),
    timezone: target.timezone,
  });
  const localDate =
    typeof requestedDate === 'string' && requestedDate.length > 0
      ? requestedDate
      : dueDispatch.localDate;
  const payload: DailySummaryQueueMessage = {
    restaurantId: target.restaurantId,
    localDate,
    recipient: target.recipient,
    timezone: target.timezone,
    dryRun,
  };
  const preview = await buildDailySummaryPreview(env, {
    restaurantId: target.restaurantId,
    localDate,
    timezone: target.timezone,
  });
  const idempotency = await getIdempotencyClient(env, payload);
  if (force) {
    await idempotency.reset();
  }
  const idempotencyStatus = await idempotency.status();

  if (dryRun) {
    return json({
      ok: true,
      service: SERVICE_NAME,
      dryRun: true,
      force,
      payload,
      dueState: {
        dueNow: dueDispatch.dueNow,
        localDate: dueDispatch.localDate,
        sendAtIso: dueDispatch.sendAtIso,
        windowEndsIso: dueDispatch.windowEndsIso,
      },
      idempotency: idempotencyStatus,
      preview,
    });
  }

  await env.DAILY_BOOKING_SUMMARY_QUEUE.send(payload);

  return json(
    {
      ok: true,
      service: SERVICE_NAME,
      queued: true,
      force,
      payload,
      dueState: {
        dueNow: dueDispatch.dueNow,
        localDate: dueDispatch.localDate,
        sendAtIso: dueDispatch.sendAtIso,
        windowEndsIso: dueDispatch.windowEndsIso,
      },
      idempotency: idempotencyStatus,
      preview,
    },
    { status: 202 },
  );
}

async function handleQueueMessage(
  env: WorkerEnv,
  payload: DailySummaryQueueMessage,
): Promise<Record<string, unknown>> {
  const idempotency = await getIdempotencyClient(env, payload);

  return processDailySummaryDispatch({
    payload,
    idempotency,
    loadPreview: (message) =>
      buildDailySummaryPreview(env, {
        restaurantId: message.restaurantId,
        localDate: message.localDate,
        timezone: message.timezone,
      }),
    sendSms: (params) =>
      sendDailySummaryViaTwilio({
        env,
        recipient: params.recipient,
        message: params.message,
      }),
  });
}

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: SERVICE_NAME });
    }

    if (request.method === 'POST' && url.pathname === '/internal/dispatch-daily-summary') {
      return handleManualDispatch(request, env);
    }

    return json({ error: 'Not found' }, { status: 404 });
  },

  async scheduled(_controller: any, env: WorkerEnv): Promise<void> {
    const targets = await listRestaurantDailySummaryTargets(env);
    const dueDispatches = selectDueDispatches(targets, new Date());

    await Promise.all(
      dueDispatches.map((target) =>
        env.DAILY_BOOKING_SUMMARY_QUEUE.send({
          restaurantId: target.restaurantId,
          localDate: target.localDate,
          recipient: target.recipient,
          timezone: target.timezone,
          dryRun: false,
        }),
      ),
    );
  },

  async queue(batch: any, env: WorkerEnv): Promise<void> {
    for (const message of batch.messages as Array<{
      body: DailySummaryQueueMessage;
      ack?: () => void;
      retry?: () => void;
    }>) {
      try {
        await handleQueueMessage(env, message.body);
        getQueueMessageAck(message);
      } catch (error) {
        console.error('[sms-summary-gateway] queue message failed', {
          error: error instanceof Error ? error.message : String(error),
          payload: message.body,
        });

        if (error instanceof TerminalDispatchError) {
          getQueueMessageAck(message);
          continue;
        }

        getQueueMessageRetry(message);
      }
    }
  },
};

export default worker;
