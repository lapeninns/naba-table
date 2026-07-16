import 'server-only';

import { env } from '@/lib/env';
import { fetchTwilioMessage, type TwilioMessageRecord } from '@/lib/twilio/sms';
import {
  finalizeMobileSmsAttempt,
  mapProviderMobileStatus,
  type MobileAttemptStatus,
} from '@/server/notifications/mobile';
import { processWhatsAppStatusCallback } from '@/server/notifications/whatsapp-status';
import { getServiceSupabaseClient } from '@/server/supabase';

const MAX_TWILIO_STATUS_FETCHES = 100;
const MOBILE_RECONCILE_DELAY_MS = 10 * 60 * 1000;
const MOBILE_RECONCILE_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const MOBILE_IN_FLIGHT_STATUSES = ['claimed', 'accepted', 'queued', 'sent'] as const;

export type MobileDeliveryCandidate = {
  readonly channel: 'sms' | 'whatsapp';
  readonly id: string;
  readonly providerMessageId: string | null;
  readonly status: string;
  readonly updatedAt: string;
};

export type MobileDeliveryReconcileReport = {
  readonly fetchErrors: number;
  readonly fetched: number;
  readonly resolvedSms: number;
  readonly resolvedWhatsApp: number;
  readonly stuck: number;
  readonly unpollable: number;
  readonly whatsappFallbacksSent: number;
};

type MobileDeliveryReconcileDependencies = {
  readonly fetchMessage: (
    messageSid: string,
  ) => Promise<Pick<TwilioMessageRecord, 'errorCode' | 'sid' | 'status' | 'to'>>;
  readonly finalizeSms: typeof finalizeMobileSmsAttempt;
  readonly processWhatsApp: typeof processWhatsAppStatusCallback;
};

function isSupportedProviderStatus(status: string | null): boolean {
  switch (status?.trim().toLowerCase()) {
    case 'accepted':
    case 'queued':
    case 'scheduled':
    case 'sending':
    case 'sent':
    case 'delivered':
    case 'read':
    case 'undelivered':
    case 'failed':
    case 'canceled':
      return true;
    default:
      return false;
  }
}

function isTerminalStatus(status: MobileAttemptStatus): boolean {
  return (
    status === 'delivered' || status === 'read' || status === 'undelivered' || status === 'failed'
  );
}

export async function reconcileMobileDeliveryCandidatesWithDependencies(
  candidates: readonly MobileDeliveryCandidate[],
  dependencies: MobileDeliveryReconcileDependencies,
): Promise<MobileDeliveryReconcileReport> {
  let fetchErrors = 0;
  let fetched = 0;
  let resolvedSms = 0;
  let resolvedWhatsApp = 0;
  let stuck = 0;
  let unpollable = 0;
  let whatsappFallbacksSent = 0;

  for (const candidate of candidates) {
    if (!candidate.providerMessageId) {
      unpollable += 1;
      stuck += 1;
      continue;
    }
    if (fetched >= MAX_TWILIO_STATUS_FETCHES) {
      stuck += 1;
      continue;
    }

    fetched += 1;
    let message: Pick<TwilioMessageRecord, 'errorCode' | 'sid' | 'status' | 'to'>;
    try {
      message = await dependencies.fetchMessage(candidate.providerMessageId);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      fetchErrors += 1;
      stuck += 1;
      continue;
    }

    if (!isSupportedProviderStatus(message.status)) {
      stuck += 1;
      continue;
    }

    const mappedStatus = mapProviderMobileStatus(message.status);
    const errorCode = message.errorCode === null ? null : String(message.errorCode);

    if (candidate.channel === 'sms') {
      const persistedStatus = await dependencies.finalizeSms({
        attemptId: candidate.id,
        errorCode,
        providerMessageId: message.sid,
        status: mappedStatus,
      });
      if (isTerminalStatus(persistedStatus)) {
        resolvedSms += 1;
      } else {
        stuck += 1;
      }
      continue;
    }

    if (!message.to) {
      stuck += 1;
      continue;
    }
    const result = await dependencies.processWhatsApp({
      attemptId: candidate.id,
      errorCode,
      messageSid: message.sid,
      providerStatus: message.status ?? '',
      recipientPhone: message.to,
    });
    if (!result.ignored && isTerminalStatus(mappedStatus)) {
      resolvedWhatsApp += 1;
      if (result.fallbackSent) whatsappFallbacksSent += 1;
    } else {
      stuck += 1;
    }
  }

  return {
    fetchErrors,
    fetched,
    resolvedSms,
    resolvedWhatsApp,
    stuck,
    unpollable,
    whatsappFallbacksSent,
  };
}

function parseChannel(value: string): 'sms' | 'whatsapp' | null {
  if (value === 'sms' || value === 'whatsapp') return value;
  return null;
}

export async function reconcileMobileDeliveryAttempts(): Promise<
  MobileDeliveryReconcileReport & { readonly scanned: number; readonly error?: string }
> {
  const client = getServiceSupabaseClient();
  const now = Date.now();
  const { data, error } = await client
    .from('mobile_notification_attempts')
    .select('id,channel,provider_message_id,status,updated_at')
    .eq('provider', 'twilio')
    .gte('updated_at', new Date(now - MOBILE_RECONCILE_LOOKBACK_MS).toISOString())
    .lte('updated_at', new Date(now - MOBILE_RECONCILE_DELAY_MS).toISOString())
    .in('status', MOBILE_IN_FLIGHT_STATUSES)
    .order('updated_at', { ascending: true })
    .limit(5_000);

  if (error) {
    return {
      error: error.message,
      fetchErrors: 0,
      fetched: 0,
      resolvedSms: 0,
      resolvedWhatsApp: 0,
      scanned: 0,
      stuck: 0,
      unpollable: 0,
      whatsappFallbacksSent: 0,
    };
  }

  const candidates: MobileDeliveryCandidate[] = [];
  for (const row of data ?? []) {
    const channel = parseChannel(row.channel);
    if (!channel) continue;
    candidates.push({
      channel,
      id: row.id,
      providerMessageId: row.provider_message_id,
      status: row.status,
      updatedAt: row.updated_at,
    });
  }

  const { accountSid, apiKeySid, apiKeySecret, authToken } = env.twilio;
  if (!accountSid || (!authToken && !(apiKeySid && apiKeySecret))) {
    return {
      fetchErrors: 0,
      fetched: 0,
      resolvedSms: 0,
      resolvedWhatsApp: 0,
      scanned: candidates.length,
      stuck: candidates.length,
      unpollable: candidates.filter((candidate) => !candidate.providerMessageId).length,
      whatsappFallbacksSent: 0,
    };
  }

  const report = await reconcileMobileDeliveryCandidatesWithDependencies(candidates, {
    fetchMessage: (messageSid) =>
      fetchTwilioMessage({
        accountSid,
        apiKeySecret: apiKeySecret ?? undefined,
        apiKeySid: apiKeySid ?? undefined,
        authToken: authToken ?? undefined,
        messageSid,
      }),
    finalizeSms: finalizeMobileSmsAttempt,
    processWhatsApp: processWhatsAppStatusCallback,
  });
  return { ...report, scanned: candidates.length };
}
