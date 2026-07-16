import { recordObservabilityEvent } from '@/server/observability';
import { reconcileLegacySmsDelivery } from '@/server/observability/legacy-sms-delivery-reconciler';
import { reconcileMobileDeliveryAttempts } from '@/server/observability/mobile-delivery-reconciler';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  EMAIL_DELIVERY_IN_FLIGHT_STATUSES,
  EMAIL_DELIVERY_STALE_THRESHOLD_HOURS,
} from '@/types/emailDelivery';

import type { Json } from '@/types/supabase';

const EMAIL_STALE_THRESHOLD_MS = EMAIL_DELIVERY_STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
const LOOKBACK_HOURS = 72;

export type DeliveryReconcileReport = {
  stuckEmailAttempts: number;
  stuckSmsAttempts: number;
  stuckMobileAttempts: number;
  scannedEmailRows: number;
  scannedSmsRows: number;
  scannedMobileRows: number;
  resolvedMobileSmsAttempts: number;
  resolvedMobileWhatsAppAttempts: number;
  mobileTwilioFetches: number;
  mobileTwilioFetchErrors: number;
  whatsappFallbacksSent: number;
  errors: Array<{ stage: 'email' | 'sms' | 'mobile'; message: string }>;
};

type EmailRow = {
  message_id: string;
  recipient_email: string;
  restaurant_id: string | null;
  occurred_at: string;
};

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
        recipientEmail: '[redacted-email]',
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
  let mobileResult: Awaited<ReturnType<typeof reconcileMobileDeliveryAttempts>> = {
    fetchErrors: 0,
    fetched: 0,
    resolvedSms: 0,
    resolvedWhatsApp: 0,
    scanned: 0,
    stuck: 0,
    unpollable: 0,
    whatsappFallbacksSent: 0,
  };

  try {
    emailResult = await reconcileEmails();
    if (emailResult.error) {
      errors.push({ stage: 'email', message: emailResult.error });
    }
  } catch (error) {
    errors.push({
      stage: 'email',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    smsResult = await reconcileLegacySmsDelivery();
    if (smsResult.error) {
      errors.push({ stage: 'sms', message: smsResult.error });
    }
  } catch (error) {
    errors.push({ stage: 'sms', message: error instanceof Error ? error.message : String(error) });
  }

  try {
    mobileResult = await reconcileMobileDeliveryAttempts();
    if (mobileResult.error) {
      errors.push({ stage: 'mobile', message: mobileResult.error });
    }
  } catch (error) {
    errors.push({
      stage: 'mobile',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const report: DeliveryReconcileReport = {
    mobileTwilioFetchErrors: mobileResult.fetchErrors,
    mobileTwilioFetches: mobileResult.fetched,
    resolvedMobileSmsAttempts: mobileResult.resolvedSms,
    resolvedMobileWhatsAppAttempts: mobileResult.resolvedWhatsApp,
    stuckEmailAttempts: emailResult.stuck,
    stuckMobileAttempts: mobileResult.stuck,
    stuckSmsAttempts: smsResult.stuck,
    scannedEmailRows: emailResult.scanned,
    scannedMobileRows: mobileResult.scanned,
    scannedSmsRows: smsResult.scanned,
    whatsappFallbacksSent: mobileResult.whatsappFallbacksSent,
    errors,
  };

  const stuckTotal =
    report.stuckEmailAttempts + report.stuckSmsAttempts + report.stuckMobileAttempts;
  if (stuckTotal > 0 || errors.length > 0) {
    try {
      await recordObservabilityEvent({
        source: 'delivery.reconciler',
        eventType: 'reconcile.summary',
        severity: stuckTotal > 0 || errors.length > 0 ? 'warning' : 'info',
        context: {
          stuckEmailAttempts: report.stuckEmailAttempts,
          stuckMobileAttempts: report.stuckMobileAttempts,
          stuckSmsAttempts: report.stuckSmsAttempts,
          scannedEmailRows: report.scannedEmailRows,
          scannedMobileRows: report.scannedMobileRows,
          scannedSmsRows: report.scannedSmsRows,
          resolvedMobileSmsAttempts: report.resolvedMobileSmsAttempts,
          resolvedMobileWhatsAppAttempts: report.resolvedMobileWhatsAppAttempts,
          mobileTwilioFetches: report.mobileTwilioFetches,
          mobileTwilioFetchErrors: report.mobileTwilioFetchErrors,
          whatsappFallbacksSent: report.whatsappFallbacksSent,
          errors: report.errors.map((entry) => ({ stage: entry.stage, message: entry.message })),
        } satisfies Json,
      });
    } catch {
      // never allow observability to crash the reconciler
    }
  }

  return report;
}
