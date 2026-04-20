import { recordObservabilityEvent } from '@/server/observability';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  EMAIL_DELIVERY_IN_FLIGHT_STATUSES,
  EMAIL_DELIVERY_STALE_THRESHOLD_HOURS,
} from '@/types/emailDelivery';

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

export type EmailDeliveryLogEntry = {
  id: string;
  bookingId: string | null;
  restaurantId: string | null;
  emailType: string | null;
  templateType: string | null;
  recipientEmail: string;
  messageId: string;
  status: EmailDeliveryStatus;
  provider: EmailDeliveryProvider | null;
  occurredAt: string;
  error: string | null;
  metadata: Json | null;
};

export class EmailDeliveryRetryError extends Error {
  readonly code: 'NOT_FOUND' | 'NOT_RETRYABLE' | 'MISSING_BOOKING';

  constructor(code: 'NOT_FOUND' | 'NOT_RETRYABLE' | 'MISSING_BOOKING', message: string) {
    super(message);
    this.name = 'EmailDeliveryRetryError';
    this.code = code;
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

export async function recordEmailDeliveryLog(params: InsertParams): Promise<EmailDeliveryLogEntry | null> {
  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('email_delivery_log')
      .insert({
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
      })
      .select('id, booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, provider, occurred_at, error, metadata')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return toEntryDto(data as EmailDeliveryLogRow);
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

    return null;
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

type BookingSnapshotRow = {
  id: string;
  reference: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  customer_name: string | null;
  party_size: number | null;
};

type ListEmailDeliveryAttemptsParams = {
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
};

type AttemptAggregate = {
  messageId: string;
  recipientEmail: string;
  bookingId: string | null;
  emailType: string | null;
  templateType: string | null;
  provider: EmailDeliveryProvider | null;
  currentStatus: EmailDeliveryStatus;
  currentOccurredAt: string | null;
  currentEventId: string;
  events: EmailDeliveryEventDTO[];
};

const FALLBACK_BATCH_SIZE = 500;
const FALLBACK_MAX_SCANNED_EVENTS = 10_000;

function toEntryDto(row: EmailDeliveryLogRow): EmailDeliveryLogEntry {
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

function resolveRangeStartIso(range: OpsEmailDeliveryRange): string {
  const now = Date.now();
  const lookbackMs =
    range === '24h' ? 24 * 60 * 60 * 1000 : range === '30d' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(now - lookbackMs).toISOString();
}

function parseIsoMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isNewerEvent(candidate: EmailDeliveryEventDTO, current: AttemptAggregate): boolean {
  const candidateMs = parseIsoMs(candidate.occurredAt);
  const currentMs = parseIsoMs(current.currentOccurredAt);
  if (candidateMs !== currentMs) return candidateMs > currentMs;
  return candidate.id > current.currentEventId;
}

function compareAttemptsByCurrentDesc(a: AttemptAggregate, b: AttemptAggregate): number {
  const byTime = parseIsoMs(b.currentOccurredAt) - parseIsoMs(a.currentOccurredAt);
  if (byTime !== 0) return byTime;
  return b.currentEventId.localeCompare(a.currentEventId);
}

const EMAIL_STALE_THRESHOLD_MS = EMAIL_DELIVERY_STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
const EMAIL_IN_FLIGHT_STATUS_SET: ReadonlySet<EmailDeliveryStatus> = new Set(EMAIL_DELIVERY_IN_FLIGHT_STATUSES);

export function computeEmailAttemptStaleness(input: {
  currentStatus: EmailDeliveryStatus;
  currentOccurredAt: string | null;
  now?: number;
}): { isStale: boolean; stuckForMs: number | null } {
  if (!EMAIL_IN_FLIGHT_STATUS_SET.has(input.currentStatus)) {
    return { isStale: false, stuckForMs: null };
  }

  const occurredMs = parseIsoMs(input.currentOccurredAt);
  if (!occurredMs) {
    return { isStale: false, stuckForMs: null };
  }

  const nowMs = typeof input.now === 'number' ? input.now : Date.now();
  const ageMs = nowMs - occurredMs;
  if (ageMs < EMAIL_STALE_THRESHOLD_MS) {
    return { isStale: false, stuckForMs: null };
  }

  return { isStale: true, stuckForMs: ageMs };
}

function decorateAttemptWithStaleness(attempt: OpsEmailDeliveryAttemptDTO, now: number): OpsEmailDeliveryAttemptDTO {
  const staleness = computeEmailAttemptStaleness({
    currentStatus: attempt.currentStatus,
    currentOccurredAt: attempt.currentOccurredAt,
    now,
  });
  if (!staleness.isStale) {
    return attempt;
  }
  return { ...attempt, isStale: true, stuckForMs: staleness.stuckForMs };
}

function toBookingDto(row: BookingSnapshotRow): NonNullable<OpsEmailDeliveryAttemptDTO['booking']> {
  return {
    id: row.id,
    reference: row.reference ?? '',
    bookingDate: row.booking_date ?? '',
    startTime: row.start_time ?? '',
    endTime: row.end_time ?? '',
    customerName: row.customer_name ?? '',
    partySize: typeof row.party_size === 'number' ? row.party_size : 0,
  };
}

async function listEmailDeliveryAttemptsWithQueryFallback(params: ListEmailDeliveryAttemptsParams): Promise<{
  attempts: OpsEmailDeliveryAttemptDTO[];
  hasNext: boolean;
  page: number;
  pageSize: number;
}> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const start = (page - 1) * pageSize;
  const needed = start + pageSize + 1;

  const normalizedStatuses = params.statuses?.length ? new Set(params.statuses) : null;
  const normalizedRecipient = normalizeOptionalString(params.recipientEmail)?.toLowerCase();
  const normalizedMessageId = normalizeOptionalString(params.messageId);
  const normalizedBookingRef = normalizeOptionalStringUpper(params.bookingRef);
  const normalizedTemplateType = normalizeOptionalString(params.templateType);
  const normalizedEmailType = normalizeOptionalString(params.emailType);
  const sinceIso = resolveRangeStartIso(params.range);

  const supabase = getServiceSupabaseClient();

  let bookingRefIds: string[] | null = null;
  if (normalizedBookingRef) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('restaurant_id', params.restaurantId)
      .eq('reference', normalizedBookingRef)
      .limit(50);

    if (error) {
      throw new Error(`Failed to resolve booking reference filter (${error.code ?? 'unknown'}).`);
    }

    bookingRefIds = (Array.isArray(data) ? data : [])
      .map((row) => (typeof row.id === 'string' ? row.id : null))
      .filter((value): value is string => Boolean(value));

    if (bookingRefIds.length === 0) {
      return { attempts: [], hasNext: false, page, pageSize };
    }
  }

  const buckets = new Map<string, AttemptAggregate>();
  let offset = 0;
  let scanned = 0;
  let exhausted = false;
  const stopWhenBucketCountSatisfied = normalizedStatuses === null;

  while (
    !exhausted &&
    scanned < FALLBACK_MAX_SCANNED_EVENTS &&
    (!stopWhenBucketCountSatisfied || buckets.size < needed)
  ) {
    let query = supabase
      .from('email_delivery_log')
      .select(
        'id, booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, provider, occurred_at, error, metadata',
      )
      .eq('restaurant_id', params.restaurantId)
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + FALLBACK_BATCH_SIZE - 1);

    if (normalizedMessageId) query = query.eq('message_id', normalizedMessageId);
    if (normalizedTemplateType) query = query.eq('template_type', normalizedTemplateType);
    if (normalizedEmailType) query = query.eq('email_type', normalizedEmailType);
    if (bookingRefIds) query = query.in('booking_id', bookingRefIds);

    const { data, error } = await query;

    if (error) {
      if (isDeliveryLogUnavailable(error)) {
        throw new EmailDeliveryLogUnavailableError();
      }
      throw new Error(`Failed to load email delivery attempts (${error.code ?? 'unknown'}).`);
    }

    const rows = (data as EmailDeliveryLogRow[] | null | undefined) ?? [];
    if (rows.length < FALLBACK_BATCH_SIZE) exhausted = true;
    offset += rows.length;
    scanned += rows.length;

    for (const row of rows) {
      const event = toEventDto(row);
      if (normalizedRecipient && event.recipientEmail.toLowerCase() !== normalizedRecipient) continue;

      const key = `${event.messageId}__${event.recipientEmail.toLowerCase()}`;
      const existing = buckets.get(key);

      if (!existing) {
        buckets.set(key, {
          messageId: event.messageId,
          recipientEmail: event.recipientEmail,
          bookingId: event.bookingId,
          emailType: event.emailType,
          templateType: event.templateType,
          provider: event.provider,
          currentStatus: event.status,
          currentOccurredAt: event.occurredAt,
          currentEventId: event.id,
          events: [event],
        });
        continue;
      }

      existing.events.push(event);
      if (isNewerEvent(event, existing)) {
        existing.bookingId = event.bookingId ?? existing.bookingId;
        existing.emailType = event.emailType ?? existing.emailType;
        existing.templateType = event.templateType ?? existing.templateType;
        existing.provider = event.provider ?? existing.provider;
        existing.currentStatus = event.status;
        existing.currentOccurredAt = event.occurredAt;
        existing.currentEventId = event.id;
      }
    }
  }

  const aggregates = Array.from(buckets.values()).filter((attempt) =>
    normalizedStatuses ? normalizedStatuses.has(attempt.currentStatus) : true,
  );

  aggregates.sort(compareAttemptsByCurrentDesc);

  const pageSlice = aggregates.slice(start, start + pageSize + 1);
  const hasMoreSlice = pageSlice.length > pageSize;
  const pageAggregates = hasMoreSlice ? pageSlice.slice(0, pageSize) : pageSlice;
  const hasNext = hasMoreSlice || (!exhausted && scanned >= FALLBACK_MAX_SCANNED_EVENTS);

  const bookingIds = Array.from(
    new Set(
      pageAggregates
        .map((attempt) => attempt.bookingId)
        .filter((bookingId): bookingId is string => typeof bookingId === 'string' && bookingId.length > 0),
    ),
  );

  let bookingById = new Map<string, NonNullable<OpsEmailDeliveryAttemptDTO['booking']>>();
  if (bookingIds.length > 0) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, reference, booking_date, start_time, end_time, customer_name, party_size')
      .in('id', bookingIds);

    if (!error) {
      bookingById = new Map(
        ((data as BookingSnapshotRow[] | null | undefined) ?? []).map((row) => [row.id, toBookingDto(row)]),
      );
    }
  }

  const now = Date.now();
  const attempts: OpsEmailDeliveryAttemptDTO[] = pageAggregates.map((attempt) =>
    decorateAttemptWithStaleness(
      {
        messageId: attempt.messageId,
        recipientEmail: attempt.recipientEmail,
        bookingId: attempt.bookingId,
        emailType: attempt.emailType,
        templateType: attempt.templateType,
        provider: attempt.provider,
        currentStatus: attempt.currentStatus,
        currentOccurredAt: attempt.currentOccurredAt,
        events: attempt.events
          .slice()
          .sort((a, b) => parseIsoMs(a.occurredAt) - parseIsoMs(b.occurredAt) || a.id.localeCompare(b.id)),
        booking: attempt.bookingId ? bookingById.get(attempt.bookingId) ?? null : null,
      },
      now,
    ),
  );

  return { attempts, hasNext, page, pageSize };
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

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOptionalStringUpper(value: unknown): string | undefined {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toUpperCase() : undefined;
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
    p_statuses: params.statuses?.length ? (params.statuses as string[]) : undefined,
    p_recipient_email: normalizeOptionalString(params.recipientEmail),
    p_message_id: normalizeOptionalString(params.messageId),
    p_booking_ref: normalizeOptionalStringUpper(params.bookingRef),
    p_template_type: normalizeOptionalString(params.templateType),
    p_email_type: normalizeOptionalString(params.emailType),
  });

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      await recordObservabilityEvent({
        source: 'email.delivery_log',
        eventType: 'attempts_feed_rpc_fallback',
        severity: 'warning',
        context: {
          restaurantId: params.restaurantId,
          range: params.range,
          page,
          pageSize,
          error: typeof error.message === 'string' ? error.message : 'rpc unavailable',
        },
        restaurantId: params.restaurantId,
      });

      return listEmailDeliveryAttemptsWithQueryFallback(params);
    }
    throw new Error(`Failed to load email delivery attempts (${error.code ?? 'unknown'}).`);
  }

  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  const hasNext = rows.length > pageSize;
  const pageRows = hasNext ? rows.slice(0, pageSize) : rows;

  const now = Date.now();
  const attempts: OpsEmailDeliveryAttemptDTO[] = pageRows.map((row) =>
    decorateAttemptWithStaleness(
      {
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
      },
      now,
    ),
  );

  return { attempts, hasNext, page, pageSize };
}

export async function getEmailDeliveryLogEntryById(deliveryLogId: string): Promise<EmailDeliveryLogEntry | null> {
  const normalizedId = normalizeOptionalString(deliveryLogId);
  if (!normalizedId) return null;

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('email_delivery_log')
    .select('id, booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, provider, occurred_at, error, metadata')
    .eq('id', normalizedId)
    .maybeSingle();

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      throw new EmailDeliveryLogUnavailableError();
    }
    throw new Error(`Failed to load email delivery entry (${error.code ?? 'unknown'}).`);
  }

  return data ? toEntryDto(data as EmailDeliveryLogRow) : null;
}

export async function retryEmailDeliveryLogEntry(params: {
  deliveryLogId: string;
  resendBookingEmail: (bookingId: string, emailType: string | null, templateType: string | null) => Promise<EmailDeliveryLogEntry | null>;
}): Promise<EmailDeliveryLogEntry> {
  const entry = await getEmailDeliveryLogEntryById(params.deliveryLogId);

  if (!entry) {
    throw new EmailDeliveryRetryError('NOT_FOUND', 'Email delivery log entry not found.');
  }

  if (entry.status !== 'failed' && entry.status !== 'bounced') {
    throw new EmailDeliveryRetryError('NOT_RETRYABLE', 'Only failed or bounced emails can be retried.');
  }

  if (!entry.bookingId) {
    throw new EmailDeliveryRetryError('MISSING_BOOKING', 'The original booking could not be determined for this delivery log entry.');
  }

  const resent = await params.resendBookingEmail(entry.bookingId, entry.emailType, entry.templateType);
  if (!resent) {
    throw new Error('Retry email send did not create a delivery log entry.');
  }

  return resent;
}

async function countStuckInFlightEmailAttempts(params: {
  restaurantId: string;
  range: OpsEmailDeliveryRange;
}): Promise<number> {
  const sinceIso = resolveRangeStartIso(params.range);
  const staleCutoffIso = new Date(Date.now() - EMAIL_STALE_THRESHOLD_MS).toISOString();
  const supabase = getServiceSupabaseClient();

  // Find message/recipient pairs that have an in-flight event older than the
  // stale threshold AND no newer terminal event. We can't express that in one
  // PostgREST query efficiently, so we fetch the small set of stale in-flight
  // rows and filter out any pair that has a later terminal event in memory.
  const { data: inflightRows, error: inflightError } = await supabase
    .from('email_delivery_log')
    .select('message_id, recipient_email, occurred_at')
    .eq('restaurant_id', params.restaurantId)
    .gte('occurred_at', sinceIso)
    .lte('occurred_at', staleCutoffIso)
    .in('status', EMAIL_DELIVERY_IN_FLIGHT_STATUSES as unknown as string[])
    .limit(1_000);

  if (inflightError) {
    if (isDeliveryLogUnavailable(inflightError)) {
      throw new EmailDeliveryLogUnavailableError();
    }
    // Non-fatal: summary is still useful without this number.
    console.warn('[email][delivery-log] stuck-count query failed', { message: inflightError.message });
    return 0;
  }

  const candidates = new Map<string, { messageId: string; recipientEmail: string; occurredAt: string }>();
  for (const row of inflightRows ?? []) {
    const messageId = typeof row.message_id === 'string' ? row.message_id : '';
    const recipient = typeof row.recipient_email === 'string' ? row.recipient_email : '';
    const occurredAt = typeof row.occurred_at === 'string' ? row.occurred_at : '';
    if (!messageId || !recipient || !occurredAt) continue;
    const key = `${messageId}__${recipient.toLowerCase()}`;
    const existing = candidates.get(key);
    if (!existing || parseIsoMs(occurredAt) > parseIsoMs(existing.occurredAt)) {
      candidates.set(key, { messageId, recipientEmail: recipient, occurredAt });
    }
  }

  if (candidates.size === 0) return 0;

  const messageIds = Array.from(new Set(Array.from(candidates.values()).map((c) => c.messageId)));
  const { data: terminalRows, error: terminalError } = await supabase
    .from('email_delivery_log')
    .select('message_id, recipient_email, status, occurred_at')
    .eq('restaurant_id', params.restaurantId)
    .in('status', ['delivered', 'bounced', 'complained', 'failed'])
    .in('message_id', messageIds)
    .limit(5_000);

  if (terminalError) {
    console.warn('[email][delivery-log] stuck-count terminal query failed', { message: terminalError.message });
    // Conservative fallback: assume none of the stale in-flight rows were
    // superseded. This may over-count, which is acceptable for an alert.
    return candidates.size;
  }

  const supersededKeys = new Set<string>();
  for (const row of terminalRows ?? []) {
    const messageId = typeof row.message_id === 'string' ? row.message_id : '';
    const recipient = typeof row.recipient_email === 'string' ? row.recipient_email : '';
    const occurredAt = typeof row.occurred_at === 'string' ? row.occurred_at : '';
    if (!messageId || !recipient || !occurredAt) continue;
    const key = `${messageId}__${recipient.toLowerCase()}`;
    const candidate = candidates.get(key);
    if (!candidate) continue;
    if (parseIsoMs(occurredAt) >= parseIsoMs(candidate.occurredAt)) {
      supersededKeys.add(key);
    }
  }

  let stuck = 0;
  for (const key of candidates.keys()) {
    if (!supersededKeys.has(key)) stuck += 1;
  }
  return stuck;
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
    p_statuses: params.statuses?.length ? (params.statuses as string[]) : undefined,
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

  let stuckInFlight = 0;
  try {
    stuckInFlight = await countStuckInFlightEmailAttempts({
      restaurantId: params.restaurantId,
      range: params.range,
    });
  } catch (stuckError) {
    if (stuckError instanceof EmailDeliveryLogUnavailableError) {
      throw stuckError;
    }
    // Non-fatal; summary is still returned with stuckInFlight defaulted to 0.
    console.warn('[email][delivery-log] stuck-count computation failed', {
      message: stuckError instanceof Error ? stuckError.message : String(stuckError),
    });
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
      stuckInFlight,
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
    stuckInFlight,
  };
}
