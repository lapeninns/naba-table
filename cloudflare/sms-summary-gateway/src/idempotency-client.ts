import type { DailySummaryQueueMessage } from './contracts';
import type { IdempotencyClient } from './job';
import type { SmsSummaryWorkerEnv } from './worker-env';

type SummaryLocator = Pick<DailySummaryQueueMessage, 'restaurantId' | 'localDate' | 'recipient'>;
type IdempotencyEnv = Pick<SmsSummaryWorkerEnv, 'DAILY_BOOKING_SUMMARY_STATE'>;

function buildIdempotencyName(payload: SummaryLocator): string {
  return `daily-booking-summary:${payload.restaurantId}:${payload.localDate}:${payload.recipient}`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

async function requestIdempotency(
  env: IdempotencyEnv,
  payload: SummaryLocator,
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
  const parsed: unknown = JSON.parse(raw);
  return toRecord(parsed);
}

export function getIdempotencyClient(
  env: SmsSummaryWorkerEnv,
  payload: DailySummaryQueueMessage,
): IdempotencyClient & {
  reset: () => Promise<void>;
  status: () => Promise<Record<string, unknown> | null>;
} {
  return {
    claim: async () => {
      const body = await requestIdempotency(env, payload, '/claim', { method: 'POST' });
      if (body?.status === 'already_sent') {
        return {
          status: 'already_sent',
          providerMessageId:
            typeof body.providerMessageId === 'string' ? body.providerMessageId : null,
          sentAt: typeof body.sentAt === 'string' ? body.sentAt : null,
        };
      }
      if (body?.status === 'locked') {
        return {
          status: 'locked',
          lockUntil: typeof body.lockUntil === 'string' ? body.lockUntil : null,
        };
      }
      return { status: 'claimed' };
    },
    prepareWhatsApp: async ({ callbackToken, message, recipient }) => {
      await requestIdempotency(env, payload, '/prepare-whatsapp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callbackToken, message, recipient }),
      });
    },
    markSent: async ({ channel, message, providerMessageId, recipient }) => {
      await requestIdempotency(env, payload, '/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel, message, providerMessageId, recipient }),
      });
    },
    release: async () => {
      await requestIdempotency(env, payload, '/release', { method: 'POST' });
    },
    reset: async () => {
      await requestIdempotency(env, payload, '/reset', { method: 'POST' });
    },
    status: async () => requestIdempotency(env, payload, '/status'),
  };
}

export function getManagerFallbackClient(
  env: IdempotencyEnv,
  payload: SummaryLocator,
): {
  claimFallback: (input: {
    callbackToken: string;
    providerMessageId: string;
    recipient: string;
  }) => Promise<Record<string, unknown> | null>;
  completeFallback: (input: {
    smsMessageSid: string | null;
    whatsappMessageSid: string;
  }) => Promise<void>;
  releaseFallback: (input: { whatsappMessageSid: string }) => Promise<void>;
} {
  return {
    claimFallback: (input) =>
      requestIdempotency(env, payload, '/claim-fallback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    completeFallback: async (input) => {
      await requestIdempotency(env, payload, '/complete-fallback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    },
    releaseFallback: async (input) => {
      await requestIdempotency(env, payload, '/release-fallback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    },
  };
}
