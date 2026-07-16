import { SERVICE_NAME } from './contracts';
import { json } from './gateway-http';
import { getManagerFallbackClient } from './idempotency-client';
import { sendDailySummaryViaTwilio } from './job';
import { parseManagerWhatsAppStatusRequest } from './manager-whatsapp-status-request';
import { fetchTwilioMessage } from './twilio';
import { writeStructuredLog } from '../../shared/observability';

import type { SmsSummaryWorkerEnv } from './worker-env';

const FAILURE_STATUSES = new Set(['failed', 'undelivered']);

type ManagerWhatsAppRuntimeEnv = Pick<
  SmsSummaryWorkerEnv,
  | 'DAILY_BOOKING_SUMMARY_STATE'
  | 'TWILIO_ACCOUNT_SID'
  | 'TWILIO_API_KEY_SID'
  | 'TWILIO_API_KEY_SECRET'
  | 'TWILIO_MESSAGING_SERVICE_SID'
>;
type ManagerWhatsAppStatusEnv = Partial<ManagerWhatsAppRuntimeEnv>;

type FallbackClaim =
  | { status: 'claimed'; message: string }
  | { status: 'already_sent' | 'not_found' }
  | { status: 'locked' };

export type ManagerWhatsAppStatusDependencies = {
  claimFallback: (input: {
    callbackToken: string;
    localDate: string;
    providerMessageId: string;
    recipient: string;
    restaurantId: string;
  }) => Promise<FallbackClaim>;
  completeFallback: (input: {
    smsMessageSid: string | null;
    whatsappMessageSid: string;
  }) => Promise<void>;
  releaseFallback: (input: { whatsappMessageSid: string }) => Promise<void>;
  sendSms: (input: {
    message: string;
    recipient: string;
  }) => Promise<{ messageSid: string | null }>;
  verifyProviderFailure: (input: {
    recipient: string;
    whatsappMessageSid: string;
  }) => Promise<boolean>;
};

function isRuntimeEnv(env: ManagerWhatsAppStatusEnv): env is ManagerWhatsAppRuntimeEnv {
  return (
    env.DAILY_BOOKING_SUMMARY_STATE !== undefined &&
    typeof env.TWILIO_ACCOUNT_SID === 'string' &&
    typeof env.TWILIO_API_KEY_SID === 'string' &&
    typeof env.TWILIO_API_KEY_SECRET === 'string' &&
    typeof env.TWILIO_MESSAGING_SERVICE_SID === 'string'
  );
}

function parseClaim(value: Record<string, unknown> | null): FallbackClaim {
  if (value?.status === 'claimed' && typeof value.message === 'string' && value.message.trim()) {
    return { status: 'claimed', message: value.message };
  }
  if (value?.status === 'locked') return { status: 'locked' };
  if (value?.status === 'already_sent') return { status: 'already_sent' };
  return { status: 'not_found' };
}

function createDependencies(
  env: ManagerWhatsAppRuntimeEnv,
  locator: { localDate: string; recipient: string; restaurantId: string },
): ManagerWhatsAppStatusDependencies {
  const client = getManagerFallbackClient(env, locator);
  return {
    claimFallback: async ({ callbackToken, providerMessageId, recipient }) => {
      return parseClaim(
        await client.claimFallback({ callbackToken, providerMessageId, recipient }),
      );
    },
    completeFallback: client.completeFallback,
    releaseFallback: client.releaseFallback,
    sendSms: (input) =>
      sendDailySummaryViaTwilio({
        env,
        message: input.message,
        recipient: input.recipient,
      }),
    verifyProviderFailure: async ({ recipient, whatsappMessageSid }) => {
      const message = await fetchTwilioMessage({
        accountSid: env.TWILIO_ACCOUNT_SID,
        apiKeySid: env.TWILIO_API_KEY_SID,
        apiKeySecret: env.TWILIO_API_KEY_SECRET,
        messageSid: whatsappMessageSid,
      });
      return (
        message !== null &&
        FAILURE_STATUSES.has(message.status ?? '') &&
        message.to?.replace(/^whatsapp:/i, '') === recipient
      );
    },
  };
}

export async function handleManagerWhatsAppStatus(
  request: Request,
  env: ManagerWhatsAppStatusEnv,
  injectedDependencies?: ManagerWhatsAppStatusDependencies,
): Promise<Response> {
  const parsed = await parseManagerWhatsAppStatusRequest(request);
  if (parsed.response) return parsed.response;
  const { callbackToken, localDate, providerStatus, recipient, restaurantId, whatsappMessageSid } =
    parsed.input;
  if (!FAILURE_STATUSES.has(providerStatus)) {
    return json({ ok: true, ignored: true, fallbackSent: false });
  }

  if (!injectedDependencies && !isRuntimeEnv(env)) {
    return json({ error: 'Webhook not configured' }, { status: 503 });
  }
  const dependencies =
    injectedDependencies ??
    (isRuntimeEnv(env) ? createDependencies(env, { localDate, recipient, restaurantId }) : null);
  if (!dependencies) {
    return json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const claim = await dependencies.claimFallback({
    callbackToken,
    localDate,
    providerMessageId: whatsappMessageSid,
    recipient,
    restaurantId,
  });
  if (claim.status === 'locked') {
    return json({ error: 'Fallback is being processed' }, { status: 503 });
  }
  if (claim.status !== 'claimed') {
    return json({ ok: true, ignored: true, fallbackSent: false });
  }

  try {
    const verified = await dependencies.verifyProviderFailure({
      recipient,
      whatsappMessageSid,
    });
    if (!verified) {
      await dependencies.releaseFallback({ whatsappMessageSid });
      return json({ error: 'Provider failure not confirmed' }, { status: 503 });
    }
  } catch (error) {
    await dependencies.releaseFallback({ whatsappMessageSid });
    writeStructuredLog({
      level: 'error',
      event: 'daily_summary.whatsapp_provider_readback_failed',
      service: SERVICE_NAME,
      fields: {
        error: error instanceof Error ? error.message : String(error),
        localDate,
        restaurantId,
      },
    });
    return json({ error: 'Provider readback failed' }, { status: 503 });
  }

  let sent: { messageSid: string | null };
  try {
    sent = await dependencies.sendSms({ message: claim.message, recipient });
  } catch (error) {
    await dependencies.releaseFallback({ whatsappMessageSid });
    writeStructuredLog({
      level: 'error',
      event: 'daily_summary.whatsapp_fallback_failed',
      service: SERVICE_NAME,
      fields: {
        error: error instanceof Error ? error.message : String(error),
        localDate,
        restaurantId,
      },
    });
    return json({ error: 'Fallback send failed' }, { status: 503 });
  }

  try {
    await dependencies.completeFallback({
      smsMessageSid: sent.messageSid,
      whatsappMessageSid,
    });
    writeStructuredLog({
      level: 'info',
      event: 'daily_summary.whatsapp_fallback_sent',
      service: SERVICE_NAME,
      fields: { localDate, restaurantId, providerStatus },
    });
    return json({ ok: true, ignored: false, fallbackSent: true });
  } catch (error) {
    writeStructuredLog({
      level: 'error',
      event: 'daily_summary.whatsapp_fallback_reconciliation_required',
      service: SERVICE_NAME,
      fields: {
        error: error instanceof Error ? error.message : String(error),
        localDate,
        restaurantId,
      },
    });
    return json({ error: 'Fallback reconciliation required' }, { status: 503 });
  }
}
