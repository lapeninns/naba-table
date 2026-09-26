import { createEmailIdempotencyKey, isEmailRecipientSuppressedError } from '@/libs/resend';
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
  reviewRequestId: string | null;
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

export type EmailDeliveryRetryErrorCode =
  | 'NOT_FOUND'
  | 'NOT_RETRYABLE'
  | 'MISSING_BOOKING'
  | 'MISSING_RECIPIENT'
  | 'RETRY_IN_PROGRESS'
  | 'ALREADY_RETRIED'
  | 'RECIPIENT_SUPPRESSED'
  | 'SEND_FAILED';

export class EmailDeliveryRetryError extends Error {
  readonly code: EmailDeliveryRetryErrorCode;

  constructor(code: EmailDeliveryRetryErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'EmailDeliveryRetryError';
    this.code = code;
  }
}

type InsertParams = {
  bookingId?: string | null;
  restaurantId?: string | null;
  reviewRequestId?: string | null;
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

function isAmbiguousColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const anyErr = error as { code?: unknown };
  return anyErr.code === '42702';
}

export async function recordEmailDeliveryLog(
  params: InsertParams,
): Promise<EmailDeliveryLogEntry | null> {
  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('email_delivery_log')
      .insert({
        booking_id: params.bookingId ?? null,
        restaurant_id: params.restaurantId ?? null,
        review_request_id: params.reviewRequestId ?? null,
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
      .select(
        'id, booking_id, restaurant_id, review_request_id, email_type, template_type, recipient_email, message_id, status, provider, occurred_at, error, metadata',
      )
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
}): Promise<{
  bookingId: string | null;
  restaurantId: string | null;
  reviewRequestId: string | null;
  emailType: string | null;
  templateType: string | null;
} | null> {
  const supabase = getServiceSupabaseClient();
  const query = supabase
    .from('email_delivery_log')
    .select('booking_id, restaurant_id, review_request_id, email_type, template_type')
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
    reviewRequestId: (data.review_request_id as string | null) ?? null,
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
  const withinMs =
    typeof params.withinMs === 'number' && params.withinMs > 0
      ? params.withinMs
      : 30 * 24 * 60 * 60 * 1000;
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
  review_request_id: string | null;
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
  stuckOnly?: boolean;
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
    reviewRequestId: row.review_request_id ?? null,
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
    range === '24h'
      ? 24 * 60 * 60 * 1000
      : range === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
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
const EMAIL_IN_FLIGHT_STATUS_SET: ReadonlySet<EmailDeliveryStatus> = new Set(
  EMAIL_DELIVERY_IN_FLIGHT_STATUSES,
);

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

function decorateAttemptWithStaleness(
  attempt: OpsEmailDeliveryAttemptDTO,
  now: number,
): OpsEmailDeliveryAttemptDTO {
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

async function listEmailDeliveryAttemptsWithQueryFallback(
  params: ListEmailDeliveryAttemptsParams,
): Promise<{
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
      if (normalizedRecipient && event.recipientEmail.toLowerCase() !== normalizedRecipient)
        continue;

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
        .filter(
          (bookingId): bookingId is string => typeof bookingId === 'string' && bookingId.length > 0,
        ),
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
        ((data as BookingSnapshotRow[] | null | undefined) ?? []).map((row) => [
          row.id,
          toBookingDto(row),
        ]),
      );
    }
  }

  const now = Date.now();
  let attempts: OpsEmailDeliveryAttemptDTO[] = pageAggregates.map((attempt) =>
    decorateAttemptWithStaleness(
      {
        id: attempt.currentEventId,
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
          .sort(
            (a, b) =>
              parseIsoMs(a.occurredAt) - parseIsoMs(b.occurredAt) || a.id.localeCompare(b.id),
          ),
        booking: attempt.bookingId ? (bookingById.get(attempt.bookingId) ?? null) : null,
      },
      now,
    ),
  );

  if (params.stuckOnly) {
    attempts = attempts.filter((attempt) => attempt.isStale === true);
  }

  return { attempts, hasNext, page, pageSize };
}

export async function listEmailDeliveryEventsForBooking(params: {
  bookingId: string;
  limit?: number;
}): Promise<EmailDeliveryEventDTO[]> {
  const rawLimit =
    typeof params.limit === 'number' && Number.isFinite(params.limit) ? params.limit : 50;
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
  stuckOnly?: boolean;
}): Promise<{
  attempts: OpsEmailDeliveryAttemptDTO[];
  hasNext: boolean;
  page: number;
  pageSize: number;
}> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const statuses =
    params.stuckOnly && (!params.statuses || params.statuses.length === 0)
      ? EMAIL_DELIVERY_IN_FLIGHT_STATUSES
      : params.statuses;

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('ops_email_delivery_attempts_feed', {
    p_restaurant_id: params.restaurantId,
    p_range: params.range,
    p_page: page,
    p_page_size: pageSize,
    p_statuses: statuses?.length ? (statuses as string[]) : undefined,
    p_recipient_email: normalizeOptionalString(params.recipientEmail),
    p_message_id: normalizeOptionalString(params.messageId),
    p_booking_ref: normalizeOptionalStringUpper(params.bookingRef),
    p_template_type: normalizeOptionalString(params.templateType),
    p_email_type: normalizeOptionalString(params.emailType),
  });

  if (error) {
    if (isDeliveryLogUnavailable(error) || isAmbiguousColumnError(error)) {
      await recordObservabilityEvent({
        source: 'email.delivery_log',
        eventType: 'attempts_feed_rpc_fallback',
        severity: 'warning',
        context: {
          restaurantId: params.restaurantId,
          range: params.range,
          page,
          pageSize,
          errorCode: typeof error.code === 'string' ? error.code : null,
          error: typeof error.message === 'string' ? error.message : 'rpc unavailable',
        },
        restaurantId: params.restaurantId,
      });

      return listEmailDeliveryAttemptsWithQueryFallback({ ...params, statuses });
    }
    throw new Error(`Failed to load email delivery attempts (${error.code ?? 'unknown'}).`);
  }

  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  const hasNext = rows.length > pageSize;
  const pageRows = hasNext ? rows.slice(0, pageSize) : rows;

  const now = Date.now();
  let attempts: OpsEmailDeliveryAttemptDTO[] = pageRows.map((row) =>
    decorateAttemptWithStaleness(
      {
        id: typeof row.id === 'string' ? row.id : undefined,
        messageId: String(row.messageId ?? ''),
        recipientEmail: String(row.recipientEmail ?? ''),
        bookingId: typeof row.bookingId === 'string' ? row.bookingId : null,
        emailType: typeof row.emailType === 'string' ? row.emailType : null,
        templateType: typeof row.templateType === 'string' ? row.templateType : null,
        provider: typeof row.provider === 'string' ? (row.provider as EmailDeliveryProvider) : null,
        currentStatus: row.currentStatus as EmailDeliveryStatus,
        currentOccurredAt: typeof row.currentOccurredAt === 'string' ? row.currentOccurredAt : null,
        events: ensureArray<EmailDeliveryEventDTO>(row.events),
        booking:
          (ensureObject<Record<string, unknown>>(
            row.booking,
          ) as OpsEmailDeliveryAttemptDTO['booking']) ?? null,
      },
      now,
    ),
  );

  if (params.stuckOnly) {
    attempts = attempts.filter((attempt) => attempt.isStale === true);
  }

  return { attempts, hasNext, page, pageSize };
}

export async function getEmailDeliveryLogEntryById(
  deliveryLogId: string,
  options?: { restaurantId?: string | null },
): Promise<EmailDeliveryLogEntry | null> {
  const normalizedId = normalizeOptionalString(deliveryLogId);
  if (!normalizedId) return null;

  const restaurantId = normalizeOptionalString(options?.restaurantId ?? null);

  const supabase = getServiceSupabaseClient();
  let query = supabase
    .from('email_delivery_log')
    .select(
      'id, booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, provider, occurred_at, error, metadata',
    )
    .eq('id', normalizedId);

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      throw new EmailDeliveryLogUnavailableError();
    }
    throw new Error(`Failed to load email delivery entry (${error.code ?? 'unknown'}).`);
  }

  return data ? toEntryDto(data as EmailDeliveryLogRow) : null;
}

export type EmailDeliveryResendFn = (
  bookingId: string,
  emailType: string | null,
  templateType: string | null,
  options: { idempotencyKey: string },
) => Promise<EmailDeliveryLogEntry | null>;

export type EmailDeliveryRetryResult = {
  status: 'sent';
  retryAttempt: number;
  /** The new delivery-log row, or null when the email was sent but its log insert failed. */
  deliveryLogEntry: EmailDeliveryLogEntry | null;
};

type RetryClaim = {
  retryAttempt: number;
  bookingId: string;
  emailType: string | null;
  templateType: string | null;
};

const RETRY_CLAIM_OUTCOME_ERRORS: Record<string, EmailDeliveryRetryError> = {
  not_found: new EmailDeliveryRetryError('NOT_FOUND', 'Email delivery log entry not found.'),
  not_retryable: new EmailDeliveryRetryError(
    'NOT_RETRYABLE',
    'Only failed or bounced emails can be retried.',
  ),
  missing_booking: new EmailDeliveryRetryError(
    'MISSING_BOOKING',
    'The original booking could not be determined for this email.',
  ),
  in_progress: new EmailDeliveryRetryError(
    'RETRY_IN_PROGRESS',
    'This email is already being resent.',
  ),
  already_retried: new EmailDeliveryRetryError('ALREADY_RETRIED', 'This email was already resent.'),
};

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function claimEmailDeliveryRetry(params: {
  deliveryLogId: string;
  restaurantId: string;
}): Promise<RetryClaim> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('claim_email_delivery_retry_v1', {
    p_delivery_log_id: params.deliveryLogId,
    p_restaurant_id: params.restaurantId,
  });

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      throw new EmailDeliveryLogUnavailableError();
    }
    throw new Error(`Failed to claim email delivery retry (${error.code ?? 'unknown'}).`);
  }

  const claim = ensureObject<Record<string, unknown>>(data) ?? {};
  const outcome = readString(claim, 'outcome');
  if (outcome !== 'claimed') {
    throw (
      RETRY_CLAIM_OUTCOME_ERRORS[outcome ?? ''] ??
      new Error('Unexpected email delivery retry claim outcome.')
    );
  }

  const retryAttempt = claim.retryAttempt;
  const bookingId = readString(claim, 'bookingId');
  if (typeof retryAttempt !== 'number' || !Number.isInteger(retryAttempt) || !bookingId) {
    throw new Error('Malformed email delivery retry claim.');
  }

  return {
    retryAttempt,
    bookingId,
    emailType: readString(claim, 'emailType'),
    templateType: readString(claim, 'templateType'),
  };
}

async function completeEmailDeliveryRetry(params: {
  deliveryLogId: string;
  restaurantId: string;
  retryAttempt: number;
  outcome: 'sent' | 'failed';
  retryDeliveryLogId: string | null;
}): Promise<void> {
  try {
    const supabase = getServiceSupabaseClient();
    const { error } = await supabase.rpc('complete_email_delivery_retry_v1', {
      p_delivery_log_id: params.deliveryLogId,
      p_restaurant_id: params.restaurantId,
      p_retry_attempt: params.retryAttempt,
      p_outcome: params.outcome,
      p_retry_delivery_log_id: params.retryDeliveryLogId,
    });
    if (error) {
      throw new Error(`complete_email_delivery_retry_v1 failed (${error.code ?? 'unknown'})`);
    }
  } catch (error) {
    // The send outcome already happened; an unrecorded outcome only delays the next retry until
    // the claim goes stale (the stale reclaim reuses the same provider idempotency key).
    await recordObservabilityEvent({
      source: 'email.delivery_log',
      eventType: 'retry_completion_failed',
      severity: 'warning',
      context: {
        deliveryLogId: params.deliveryLogId,
        retryAttempt: params.retryAttempt,
        outcome: params.outcome,
        error: error instanceof Error ? error.message : String(error),
      },
      restaurantId: params.restaurantId,
    });
  }
}

/**
 * Provider idempotency key for one manual retry attempt. It differs from the original send's key
 * (so the provider does not silently return the original, failed message) and from every other
 * retry attempt, while a stale in-flight claim reuses its attempt number and therefore its key.
 */
export function buildEmailDeliveryRetryIdempotencyKey(
  deliveryLogId: string,
  retryAttempt: number,
): string {
  return createEmailIdempotencyKey({
    scope: 'booking-email-retry',
    parts: [deliveryLogId, retryAttempt],
  });
}

/**
 * Manual resend of a failed or bounced email. The entry is claimed atomically first, so a double
 * click or a second tab gets RETRY_IN_PROGRESS / ALREADY_RETRIED instead of a second send.
 */
export async function retryEmailDeliveryLogEntry(params: {
  deliveryLogId: string;
  restaurantId: string;
  resendBookingEmail: EmailDeliveryResendFn;
}): Promise<EmailDeliveryRetryResult> {
  const claim = await claimEmailDeliveryRetry(params);
  const complete = (outcome: 'sent' | 'failed', retryDeliveryLogId: string | null) =>
    completeEmailDeliveryRetry({
      deliveryLogId: params.deliveryLogId,
      restaurantId: params.restaurantId,
      retryAttempt: claim.retryAttempt,
      outcome,
      retryDeliveryLogId,
    });

  let entry: EmailDeliveryLogEntry | null;
  try {
    entry = await params.resendBookingEmail(claim.bookingId, claim.emailType, claim.templateType, {
      idempotencyKey: buildEmailDeliveryRetryIdempotencyKey(
        params.deliveryLogId,
        claim.retryAttempt,
      ),
    });
  } catch (error) {
    await complete('failed', null);
    if (error instanceof EmailDeliveryRetryError) {
      throw error;
    }
    if (isEmailRecipientSuppressedError(error)) {
      throw new EmailDeliveryRetryError(
        'RECIPIENT_SUPPRESSED',
        'This address is blocked after a bounce or complaint, so the email was not sent.',
      );
    }
    throw new EmailDeliveryRetryError('SEND_FAILED', 'The email could not be sent.', {
      cause: error,
    });
  }

  await complete('sent', entry?.id ?? null);
  return { status: 'sent', retryAttempt: claim.retryAttempt, deliveryLogEntry: entry };
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
    console.warn('[email][delivery-log] stuck-count query failed', {
      message: inflightError.message,
    });
    return 0;
  }

  const candidates = new Map<
    string,
    { messageId: string; recipientEmail: string; occurredAt: string }
  >();
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
    console.warn('[email][delivery-log] stuck-count terminal query failed', {
      message: terminalError.message,
    });
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

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;

  let stuckInFlight =
    typeof row?.stuckInFlight === 'number' && Number.isFinite(row.stuckInFlight)
      ? Number(row.stuckInFlight)
      : null;

  if (stuckInFlight === null) {
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
      stuckInFlight = 0;
    }
  }

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
    topFailedTemplates: ensureArray<OpsEmailDeliverySummary['topFailedTemplates'][number]>(
      row.topFailedTemplates,
    ),
    topFailedEmailTypes: ensureArray<OpsEmailDeliverySummary['topFailedEmailTypes'][number]>(
      row.topFailedEmailTypes,
    ),
    stuckInFlight,
  };
}
