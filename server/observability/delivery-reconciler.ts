import { recordObservabilityEvent } from '@/server/observability';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  EMAIL_DELIVERY_IN_FLIGHT_STATUSES,
  EMAIL_DELIVERY_STALE_THRESHOLD_HOURS,
} from '@/types/emailDelivery';
import {
  SMS_DELIVERY_IN_FLIGHT_STATUSES,
  SMS_DELIVERY_STALE_THRESHOLD_MINUTES,
} from '@/types/smsDelivery';

import type { Json } from '@/types/supabase';

const EMAIL_STALE_THRESHOLD_MS = EMAIL_DELIVERY_STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
const SMS_STALE_THRESHOLD_MS = SMS_DELIVERY_STALE_THRESHOLD_MINUTES * 60 * 1000;
const LOOKBACK_HOURS = 72;

export type DeliveryReconcileReport = {
  stuckEmailAttempts: number;
  stuckSmsAttempts: number;
  scannedEmailRows: number;
  scannedSmsRows: number;
  errors: Array<{ stage: 'email' | 'sms'; message: string }>;
};

type EmailRow = { message_id: string; recipient_email: string; restaurant_id: string | null; occurred_at: string };
type SmsRow = { message_sid: string; recipient_phone: string; restaurant_id: string | null; occurred_at: string };

function keyFor(a: string, b: string): string {
  return `${a}__${b.toLowerCase()}`;
}

function parseIsoMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

async function reconcileEmails(): Promise<{ stuck: number; scanned: number; error?: string }> {
  const supabase = getServiceSupabaseClient();
  const staleCutoffIso = new Date(Date.now() - EMAIL_STALE_THRESHOLD_MS).toISOString();
  const lookbackIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const { data: inflightRows, error: inflightError } = await supabase
    .from('email_delivery_log')
    .select('message_id, recipient_email, restaurant_id, occurred_at')
    .gte('occurred_at', lookbackIso)
    .lte('occurred_at', staleCutoffIso)
    .in('status', EMAIL_DELIVERY_IN_FLIGHT_STATUSES as unknown as string[])
    .limit(5_000);

  if (inflightError) {
    return { stuck: 0, scanned: 0, error: inflightError.message };
  }

  const rows = (inflightRows ?? []) as EmailRow[];
  if (rows.length === 0) {
    return { stuck: 0, scanned: 0 };
  }

  const candidates = new Map<string, EmailRow>();
  for (const row of rows) {
    if (!row.message_id || !row.recipient_email || !row.occurred_at) continue;
    const key = keyFor(row.message_id, row.recipient_email);
    const existing = candidates.get(key);
    if (!existing || parseIsoMs(row.occurred_at) > parseIsoMs(existing.occurred_at)) {
      candidates.set(key, row);
    }
  }

  if (candidates.size === 0) {
    return { stuck: 0, scanned: rows.length };
  }

  const messageIds = Array.from(new Set(Array.from(candidates.values()).map((c) => c.message_id)));
  const { data: terminalRows } = await supabase
    .from('email_delivery_log')
    .select('message_id, recipient_email, status, occurred_at')
    .in('status', ['delivered', 'bounced', 'complained', 'failed'])
    .in('message_id', messageIds)
    .limit(10_000);

  const superseded = new Set<string>();
  for (const row of (terminalRows ?? []) as Array<{
    message_id: string;
    recipient_email: string;
    occurred_at: string;
  }>) {
    if (!row.message_id || !row.recipient_email || !row.occurred_at) continue;
    const key = keyFor(row.message_id, row.recipient_email);
    const candidate = candidates.get(key);
    if (!candidate) continue;
    if (parseIsoMs(row.occurred_at) >= parseIsoMs(candidate.occurred_at)) {
      superseded.add(key);
    }
  }

  let stuck = 0;
  for (const [key, row] of candidates) {
    if (superseded.has(key)) continue;
    stuck += 1;
    await recordObservabilityEvent({
      source: 'delivery.reconciler',
      eventType: 'email.stuck_in_flight',
      severity: 'warning',
      context: {
        messageId: row.message_id,
        recipientEmail: row.recipient_email,
        ageMs: Date.now() - parseIsoMs(row.occurred_at),
      },
      restaurantId: row.restaurant_id ?? undefined,
    });
  }

  return { stuck, scanned: rows.length };
}

async function reconcileSms(): Promise<{ stuck: number; scanned: number; error?: string }> {
  const supabase = getServiceSupabaseClient();
  const staleCutoffIso = new Date(Date.now() - SMS_STALE_THRESHOLD_MS).toISOString();
  const lookbackIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const { data: inflightRows, error: inflightError } = await supabase
    .from('sms_delivery_log')
    .select('message_sid, recipient_phone, restaurant_id, occurred_at')
    .gte('occurred_at', lookbackIso)
    .lte('occurred_at', staleCutoffIso)
    .in('status', SMS_DELIVERY_IN_FLIGHT_STATUSES as unknown as string[])
    .limit(5_000);

  if (inflightError) {
    return { stuck: 0, scanned: 0, error: inflightError.message };
  }

  const rows = (inflightRows ?? []) as SmsRow[];
  if (rows.length === 0) {
    return { stuck: 0, scanned: 0 };
  }

  const candidates = new Map<string, SmsRow>();
  for (const row of rows) {
    if (!row.message_sid || !row.recipient_phone || !row.occurred_at) continue;
    const key = keyFor(row.message_sid, row.recipient_phone);
    const existing = candidates.get(key);
    if (!existing || parseIsoMs(row.occurred_at) > parseIsoMs(existing.occurred_at)) {
      candidates.set(key, row);
    }
  }

  if (candidates.size === 0) {
    return { stuck: 0, scanned: rows.length };
  }

  const messageSids = Array.from(new Set(Array.from(candidates.values()).map((c) => c.message_sid)));
  const { data: terminalRows } = await supabase
    .from('sms_delivery_log')
    .select('message_sid, recipient_phone, status, occurred_at')
    .in('status', ['delivered', 'undelivered', 'failed'])
    .in('message_sid', messageSids)
    .limit(10_000);

  const superseded = new Set<string>();
  for (const row of (terminalRows ?? []) as Array<{
    message_sid: string;
    recipient_phone: string;
    occurred_at: string;
  }>) {
    if (!row.message_sid || !row.recipient_phone || !row.occurred_at) continue;
    const key = keyFor(row.message_sid, row.recipient_phone);
    const candidate = candidates.get(key);
    if (!candidate) continue;
    if (parseIsoMs(row.occurred_at) >= parseIsoMs(candidate.occurred_at)) {
      superseded.add(key);
    }
  }

  let stuck = 0;
  for (const [key, row] of candidates) {
    if (superseded.has(key)) continue;
    stuck += 1;
    await recordObservabilityEvent({
      source: 'delivery.reconciler',
      eventType: 'sms.stuck_in_flight',
      severity: 'warning',
      context: {
        messageSid: row.message_sid,
        recipientPhone: row.recipient_phone,
        ageMs: Date.now() - parseIsoMs(row.occurred_at),
      },
      restaurantId: row.restaurant_id ?? undefined,
    });
  }

  return { stuck, scanned: rows.length };
}

/**
 * Scan recent delivery logs for in-flight attempts that never received a
 * terminal webhook and emit observability warnings so ops can alert on them.
 * Designed to be idempotent and cheap enough to run from the existing
 * `/api/cron/process-emails` tick.
 */
export async function reconcileDeliveryAnomalies(): Promise<DeliveryReconcileReport> {
  const errors: DeliveryReconcileReport['errors'] = [];
  let emailResult: { stuck: number; scanned: number; error?: string } = { stuck: 0, scanned: 0 };
  let smsResult: { stuck: number; scanned: number; error?: string } = { stuck: 0, scanned: 0 };

  try {
    emailResult = await reconcileEmails();
    if (emailResult.error) {
      errors.push({ stage: 'email', message: emailResult.error });
    }
  } catch (error) {
    errors.push({ stage: 'email', message: error instanceof Error ? error.message : String(error) });
  }

  try {
    smsResult = await reconcileSms();
    if (smsResult.error) {
      errors.push({ stage: 'sms', message: smsResult.error });
    }
  } catch (error) {
    errors.push({ stage: 'sms', message: error instanceof Error ? error.message : String(error) });
  }

  const report: DeliveryReconcileReport = {
    stuckEmailAttempts: emailResult.stuck,
    stuckSmsAttempts: smsResult.stuck,
    scannedEmailRows: emailResult.scanned,
    scannedSmsRows: smsResult.scanned,
    errors,
  };

  const stuckTotal = report.stuckEmailAttempts + report.stuckSmsAttempts;
  if (stuckTotal > 0 || errors.length > 0) {
    try {
      await recordObservabilityEvent({
        source: 'delivery.reconciler',
        eventType: 'reconcile.summary',
        severity: stuckTotal > 0 || errors.length > 0 ? 'warning' : 'info',
        context: {
          stuckEmailAttempts: report.stuckEmailAttempts,
          stuckSmsAttempts: report.stuckSmsAttempts,
          scannedEmailRows: report.scannedEmailRows,
          scannedSmsRows: report.scannedSmsRows,
          errors: report.errors.map((entry) => ({ stage: entry.stage, message: entry.message })),
        } satisfies Json,
      });
    } catch {
      // never allow observability to crash the reconciler
    }
  }

  return report;
}
