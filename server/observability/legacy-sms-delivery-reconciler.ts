import 'server-only';

import { env } from '@/lib/env';
import { redactSmsRecipientPhone } from '@/lib/sms/phone-redaction';
import { fetchTwilioMessage, mapTwilioMessageStatusToDeliveryStatus } from '@/lib/twilio/sms';
import { recordObservabilityEvent } from '@/server/observability';
import { recordSmsDeliveryLog } from '@/server/sms/delivery-log';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  SMS_DELIVERY_IN_FLIGHT_STATUSES,
  SMS_DELIVERY_STALE_THRESHOLD_MINUTES,
} from '@/types/smsDelivery';

const SMS_STALE_THRESHOLD_MS = SMS_DELIVERY_STALE_THRESHOLD_MINUTES * 60 * 1000;
const LOOKBACK_HOURS = 72;
const MAX_TWILIO_STATUS_FETCHES = 100;

type SmsRow = {
  readonly booking_id: string | null;
  readonly message_sid: string;
  readonly occurred_at: string;
  readonly recipient_phone: string;
  readonly restaurant_id: string | null;
  readonly sms_type: string | null;
};

function keyFor(messageSid: string, recipientPhone: string): string {
  return `${messageSid}__${recipientPhone.toLowerCase()}`;
}

function parseIsoMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function toIsoStringOrNull(value: string | null | undefined): string | null {
  const ms = parseIsoMs(value);
  return ms ? new Date(ms).toISOString() : null;
}

async function refreshSmsCandidateFromTwilio(row: SmsRow): Promise<boolean> {
  const { accountSid, apiKeySid, apiKeySecret, authToken } = env.twilio;
  if (!accountSid || (!authToken && !(apiKeySid && apiKeySecret))) {
    return false;
  }

  const message = await fetchTwilioMessage({
    accountSid,
    apiKeySid: apiKeySid ?? undefined,
    apiKeySecret: apiKeySecret ?? undefined,
    authToken: authToken ?? undefined,
    messageSid: row.message_sid,
  });
  const mappedStatus = mapTwilioMessageStatusToDeliveryStatus(message.status);
  if (!mappedStatus || SMS_DELIVERY_IN_FLIGHT_STATUSES.includes(mappedStatus)) {
    return false;
  }

  await recordSmsDeliveryLog({
    bookingId: row.booking_id,
    error: message.errorMessage ?? null,
    messageSid: row.message_sid,
    metadata: {
      errorCode: message.errorCode,
      polledAt: new Date().toISOString(),
      polledStatus: message.status ?? null,
      source: 'delivery_reconciler_poll',
    },
    occurredAt:
      toIsoStringOrNull(message.dateUpdated ?? message.dateSent ?? message.dateCreated) ??
      undefined,
    provider: 'twilio',
    recipientPhone: row.recipient_phone,
    restaurantId: row.restaurant_id,
    smsType: row.sms_type,
    status: mappedStatus,
  });
  return true;
}

export async function reconcileLegacySmsDelivery(): Promise<{
  readonly error?: string;
  readonly scanned: number;
  readonly stuck: number;
}> {
  const supabase = getServiceSupabaseClient();
  const staleCutoffIso = new Date(Date.now() - SMS_STALE_THRESHOLD_MS).toISOString();
  const lookbackIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const { data: inflightRows, error: inflightError } = await supabase
    .from('sms_delivery_log')
    .select('message_sid, recipient_phone, restaurant_id, booking_id, sms_type, occurred_at')
    .gte('occurred_at', lookbackIso)
    .lte('occurred_at', staleCutoffIso)
    .in('status', SMS_DELIVERY_IN_FLIGHT_STATUSES as unknown as string[])
    .order('occurred_at', { ascending: true })
    .limit(5_000);

  if (inflightError) return { error: inflightError.message, scanned: 0, stuck: 0 };

  const rows = (inflightRows ?? []) as SmsRow[];
  const candidates = new Map<string, SmsRow>();
  for (const row of rows) {
    if (!row.message_sid || !row.recipient_phone || !row.occurred_at) continue;
    const key = keyFor(row.message_sid, row.recipient_phone);
    const existing = candidates.get(key);
    if (!existing || parseIsoMs(row.occurred_at) > parseIsoMs(existing.occurred_at)) {
      candidates.set(key, row);
    }
  }
  if (candidates.size === 0) return { scanned: rows.length, stuck: 0 };

  const messageSids = Array.from(new Set([...candidates.values()].map((row) => row.message_sid)));
  const { data: terminalRows } = await supabase
    .from('sms_delivery_log')
    .select('message_sid, recipient_phone, status, occurred_at')
    .in('status', ['delivered', 'undelivered', 'failed'])
    .in('message_sid', messageSids)
    .limit(10_000);

  const superseded = new Set<string>();
  for (const row of (terminalRows ?? []) as Array<{
    message_sid: string;
    occurred_at: string;
    recipient_phone: string;
  }>) {
    const key = keyFor(row.message_sid, row.recipient_phone);
    const candidate = candidates.get(key);
    if (candidate && parseIsoMs(row.occurred_at) >= parseIsoMs(candidate.occurred_at)) {
      superseded.add(key);
    }
  }

  let refreshed = 0;
  for (const [key, row] of candidates) {
    if (refreshed >= MAX_TWILIO_STATUS_FETCHES || superseded.has(key)) continue;
    refreshed += 1;
    try {
      if (await refreshSmsCandidateFromTwilio(row)) superseded.add(key);
    } catch (error) {
      console.warn('[delivery.reconciler] failed to refresh SMS status from Twilio', {
        error: error instanceof Error ? error.message : String(error),
        messageSid: row.message_sid,
      });
    }
  }

  let stuck = 0;
  for (const [key, row] of candidates) {
    if (superseded.has(key)) continue;
    stuck += 1;
    await recordObservabilityEvent({
      context: {
        ageMs: Date.now() - parseIsoMs(row.occurred_at),
        messageSid: row.message_sid,
        recipientPhone: redactSmsRecipientPhone(row.recipient_phone),
      },
      eventType: 'sms.stuck_in_flight',
      restaurantId: row.restaurant_id ?? undefined,
      severity: 'warning',
      source: 'delivery.reconciler',
    });
  }
  return { scanned: rows.length, stuck };
}
