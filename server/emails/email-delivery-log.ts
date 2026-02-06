import { recordObservabilityEvent } from '@/server/observability';
import { getServiceSupabaseClient } from '@/server/supabase';

import type {
  EmailDeliveryEventDTO,
  EmailDeliveryProvider,
  OpsEmailDeliveryRange,
  EmailDeliveryStatus,
  OpsEmailDeliveryAttemptDTO,
  OpsEmailDeliverySummary,
} from '@/types/emailDelivery';
import type { Json } from '@/types/supabase';

export type { EmailDeliveryProvider, EmailDeliveryStatus } from '@/types/emailDelivery';

export class EmailDeliveryLogUnavailableError extends Error {
  constructor(message = 'Email delivery log is unavailable') {
    super(message);
    this.name = 'EmailDeliveryLogUnavailableError';
  }
}

type InsertParams = {
  bookingId?: string | null;
  restaurantId?: string | null;
  emailType?: string | null;
  templateType?: string | null;
  recipientEmail: string;
  messageId: string;
  status: EmailDeliveryStatus;
  provider: EmailDeliveryProvider;
  providerEventId?: string | null;
  occurredAt?: string | null;
  error?: string | null;
  metadata?: Json | null;
};

function isDeliveryLogUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const anyErr = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = typeof anyErr.code === 'string' ? anyErr.code : '';
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  const details = typeof anyErr.details === 'string' ? anyErr.details : '';
  const hint = typeof anyErr.hint === 'string' ? anyErr.hint : '';

  const haystack = `${code} ${message} ${details} ${hint}`.toLowerCase();

  // Common Supabase/PostgREST failure modes when a table doesn't exist or isn't in schema cache.
  return (
    haystack.includes('schema cache') ||
    haystack.includes('could not find') ||
    haystack.includes('does not exist') ||
    haystack.includes('relation') ||
    haystack.includes('42p01')
  );
}

export async function recordEmailDeliveryLog(params: InsertParams): Promise<void> {
  try {
    const supabase = getServiceSupabaseClient();
    const { error } = await supabase.from('email_delivery_log').insert({
      booking_id: params.bookingId ?? null,
      restaurant_id: params.restaurantId ?? null,
      email_type: params.emailType ?? null,
      template_type: params.templateType ?? null,
      recipient_email: params.recipientEmail,
      message_id: params.messageId,
      status: params.status,
      provider: params.provider,
      provider_event_id: params.providerEventId ?? null,
      occurred_at: params.occurredAt ?? undefined,
      error: params.error ?? null,
      metadata: params.metadata ?? null,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    await recordObservabilityEvent({
      source: 'email.delivery_log',
      eventType: 'insert_failed',
      severity: 'warning',
      context: {
        status: params.status,
        provider: params.provider,
        emailType: params.emailType ?? null,
        templateType: params.templateType ?? null,
        bookingId: params.bookingId ?? null,
        restaurantId: params.restaurantId ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
      restaurantId: params.restaurantId ?? undefined,
      bookingId: params.bookingId ?? undefined,
    });
  }
}

export async function findLatestEmailDeliveryByMessageId(params: {
  messageId: string;
  recipientEmail?: string | null;
}): Promise<{ bookingId: string | null; restaurantId: string | null; emailType: string | null; templateType: string | null } | null> {
  const supabase = getServiceSupabaseClient();
  const query = supabase
    .from('email_delivery_log')
    .select('booking_id, restaurant_id, email_type, template_type')
    .eq('message_id', params.messageId)
    .order('occurred_at', { ascending: false })
    .limit(1);

  const { data, error } = params.recipientEmail
    ? await query.eq('recipient_email', params.recipientEmail).maybeSingle()
    : await query.maybeSingle();

  if (error) {
    console.warn('[email][delivery-log] lookup failed', { message: error.message });
    return null;
  }

  if (!data) return null;

  return {
    bookingId: (data.booking_id as string | null) ?? null,
    restaurantId: (data.restaurant_id as string | null) ?? null,
    emailType: (data.email_type as string | null) ?? null,
    templateType: (data.template_type as string | null) ?? null,
  };
}

export async function hasRecentEmailDelivery(params: {
  bookingId: string;
  templateType: string;
  statuses?: ReadonlyArray<EmailDeliveryStatus>;
  withinMs?: number;
}): Promise<boolean> {
  const withinMs = typeof params.withinMs === 'number' && params.withinMs > 0 ? params.withinMs : 30 * 24 * 60 * 60 * 1000;
  const statuses = params.statuses?.length ? params.statuses : (['sent', 'delivered'] as const);
  const sinceIso = new Date(Date.now() - withinMs).toISOString();

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('email_delivery_log')
    .select('id')
    .eq('booking_id', params.bookingId)
    .eq('template_type', params.templateType)
    .in('status', statuses as string[])
    .gte('occurred_at', sinceIso)
    .limit(1);

  if (error) {
    console.warn('[email][delivery-log] recent-check failed', { message: error.message });
    return false;
  }

  return (data ?? []).length > 0;
}

type EmailDeliveryLogRow = {
  id: string;
  booking_id: string | null;
  restaurant_id: string | null;
  email_type: string | null;
  template_type: string | null;
  recipient_email: string;
  message_id: string;
  status: string;
  provider: string | null;
  occurred_at: string;
  error: string | null;
  metadata: Json | null;
};

function toEventDto(row: EmailDeliveryLogRow): EmailDeliveryEventDTO {
  return {
    id: row.id,
    bookingId: row.booking_id ?? null,
    restaurantId: row.restaurant_id ?? null,
    emailType: row.email_type ?? null,
    templateType: row.template_type ?? null,
    recipientEmail: row.recipient_email,
    messageId: row.message_id,
    status: row.status as EmailDeliveryStatus,
    provider: (row.provider as EmailDeliveryProvider | null) ?? null,
    occurredAt: row.occurred_at,
    error: row.error ?? null,
    metadata: row.metadata ?? null,
  };
}

export async function listEmailDeliveryEventsForBooking(params: {
  bookingId: string;
  limit?: number;
}): Promise<EmailDeliveryEventDTO[]> {
  const rawLimit = typeof params.limit === 'number' && Number.isFinite(params.limit) ? params.limit : 50;
  const limit = Math.max(1, Math.min(200, Math.floor(rawLimit)));

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('email_delivery_log')
    .select(
      'id, booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, provider, occurred_at, error, metadata',
    )
    .eq('booking_id', params.bookingId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      throw new EmailDeliveryLogUnavailableError();
    }
    throw new Error(`Failed to load email delivery events (${error.code ?? 'unknown'}).`);
  }

  return (data as EmailDeliveryLogRow[] | null | undefined)?.map(toEventDto) ?? [];
}

function normalizePage(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

function normalizePageSize(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 50;
  return Math.max(1, Math.min(200, Math.floor(raw)));
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalStringUpper(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function ensureObject<T extends object>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) return null;
  return value as T;
}

export async function listEmailDeliveryAttemptsForRestaurant(params: {
  restaurantId: string;
  range: OpsEmailDeliveryRange;
  page?: number;
  pageSize?: number;
  statuses?: ReadonlyArray<EmailDeliveryStatus>;
  recipientEmail?: string;
  messageId?: string;
  bookingRef?: string;
  templateType?: string;
  emailType?: string;
}): Promise<{ attempts: OpsEmailDeliveryAttemptDTO[]; hasNext: boolean; page: number; pageSize: number }> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('ops_email_delivery_attempts_feed', {
    p_restaurant_id: params.restaurantId,
    p_range: params.range,
    p_page: page,
    p_page_size: pageSize,
    p_statuses: params.statuses?.length ? (params.statuses as string[]) : null,
    p_recipient_email: normalizeOptionalString(params.recipientEmail),
    p_message_id: normalizeOptionalString(params.messageId),
    p_booking_ref: normalizeOptionalStringUpper(params.bookingRef),
    p_template_type: normalizeOptionalString(params.templateType),
    p_email_type: normalizeOptionalString(params.emailType),
  });

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      throw new EmailDeliveryLogUnavailableError();
    }
    throw new Error(`Failed to load email delivery attempts (${error.code ?? 'unknown'}).`);
  }

  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  const hasNext = rows.length > pageSize;
  const pageRows = hasNext ? rows.slice(0, pageSize) : rows;

  const attempts: OpsEmailDeliveryAttemptDTO[] = pageRows.map((row) => ({
    messageId: String(row.messageId ?? ''),
    recipientEmail: String(row.recipientEmail ?? ''),
    bookingId: typeof row.bookingId === 'string' ? row.bookingId : null,
    emailType: typeof row.emailType === 'string' ? row.emailType : null,
    templateType: typeof row.templateType === 'string' ? row.templateType : null,
    provider: typeof row.provider === 'string' ? (row.provider as EmailDeliveryProvider) : null,
    currentStatus: row.currentStatus as EmailDeliveryStatus,
    currentOccurredAt: typeof row.currentOccurredAt === 'string' ? row.currentOccurredAt : null,
    events: ensureArray<EmailDeliveryEventDTO>(row.events),
    booking: (ensureObject<Record<string, unknown>>(row.booking) as OpsEmailDeliveryAttemptDTO['booking']) ?? null,
  }));

  return { attempts, hasNext, page, pageSize };
}

export async function getEmailDeliveryAttemptsSummary(params: {
  restaurantId: string;
  range: OpsEmailDeliveryRange;
  statuses?: ReadonlyArray<EmailDeliveryStatus>;
  recipientEmail?: string;
  messageId?: string;
  bookingRef?: string;
  templateType?: string;
  emailType?: string;
}): Promise<OpsEmailDeliverySummary> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('ops_email_delivery_attempts_summary', {
    p_restaurant_id: params.restaurantId,
    p_range: params.range,
    p_statuses: params.statuses?.length ? (params.statuses as string[]) : null,
    p_recipient_email: normalizeOptionalString(params.recipientEmail),
    p_message_id: normalizeOptionalString(params.messageId),
    p_booking_ref: normalizeOptionalStringUpper(params.bookingRef),
    p_template_type: normalizeOptionalString(params.templateType),
    p_email_type: normalizeOptionalString(params.emailType),
  });

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      throw new EmailDeliveryLogUnavailableError();
    }
    throw new Error(`Failed to load email delivery summary (${error.code ?? 'unknown'}).`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
  if (!row) {
    return {
      total: 0,
      sent: 0,
      delivered: 0,
      deliveryDelayed: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
      deliveredRate: 0,
      failureRate: 0,
      uniqueRecipients: 0,
      uniqueBookings: 0,
      p50DeliverySeconds: null,
      p95DeliverySeconds: null,
      topFailedTemplates: [],
      topFailedEmailTypes: [],
    };
  }

  return {
    total: Number(row.total ?? 0),
    sent: Number(row.sent ?? 0),
    delivered: Number(row.delivered ?? 0),
    deliveryDelayed: Number(row.deliveryDelayed ?? 0),
    bounced: Number(row.bounced ?? 0),
    complained: Number(row.complained ?? 0),
    failed: Number(row.failed ?? 0),
    deliveredRate: Number(row.deliveredRate ?? 0),
    failureRate: Number(row.failureRate ?? 0),
    uniqueRecipients: Number(row.uniqueRecipients ?? 0),
    uniqueBookings: Number(row.uniqueBookings ?? 0),
    p50DeliverySeconds: typeof row.p50DeliverySeconds === 'number' ? row.p50DeliverySeconds : null,
    p95DeliverySeconds: typeof row.p95DeliverySeconds === 'number' ? row.p95DeliverySeconds : null,
    topFailedTemplates: ensureArray<OpsEmailDeliverySummary['topFailedTemplates'][number]>(row.topFailedTemplates),
    topFailedEmailTypes: ensureArray<OpsEmailDeliverySummary['topFailedEmailTypes'][number]>(row.topFailedEmailTypes),
  };
}
