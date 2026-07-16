import { normalizePhone } from '@/server/customers';
import { recordObservabilityEvent } from '@/server/observability';
import {
  aggregateSmsDeliveryAttempts,
  type MobileDeliveryAttemptCandidate,
  type SmsDeliveryAttemptAggregate,
} from '@/server/sms/delivery-attempt-domain';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  SMS_DELIVERY_IN_FLIGHT_STATUSES,
  SMS_DELIVERY_STATUS_VALUES,
  SMS_DELIVERY_STALE_THRESHOLD_MINUTES,
} from '@/types/smsDelivery';

import type {
  OpsSmsDeliveryAttemptDTO,
  OpsSmsDeliveryRange,
  OpsSmsDeliverySummary,
  SmsDeliveryChannelFilter,
  SmsDeliveryEventDTO,
  SmsDeliveryProvider,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';
import type { Json } from '@/types/supabase';

export class SmsDeliveryLogUnavailableError extends Error {
  constructor(message = 'SMS delivery log is unavailable') {
    super(message);
    this.name = 'SmsDeliveryLogUnavailableError';
  }
}

type SmsDeliveryLogRow = {
  id: string;
  booking_id: string | null;
  restaurant_id: string | null;
  sms_type: string | null;
  recipient_phone: string;
  message_sid: string;
  status: string;
  provider: string | null;
  provider_event_id: string | null;
  occurred_at: string;
  error: string | null;
  metadata: Json | null;
};

export type SmsDeliveryLogEntry = SmsDeliveryEventDTO;

type InsertParams = {
  bookingId?: string | null;
  restaurantId?: string | null;
  smsType?: string | null;
  recipientPhone: string;
  messageSid: string;
  status: SmsDeliveryStatus;
  provider: SmsDeliveryProvider;
  providerEventId?: string | null;
  occurredAt?: string | null;
  error?: string | null;
  metadata?: Json | null;
};

const SMS_DELIVERY_LOG_SELECT =
  'id, booking_id, restaurant_id, sms_type, recipient_phone, message_sid, status, provider, provider_event_id, occurred_at, error, metadata';

function isDeliveryLogUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const anyErr = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = typeof anyErr.code === 'string' ? anyErr.code : '';
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  const details = typeof anyErr.details === 'string' ? anyErr.details : '';
  const hint = typeof anyErr.hint === 'string' ? anyErr.hint : '';
  const haystack = `${code} ${message} ${details} ${hint}`.toLowerCase();

  return (
    haystack.includes('schema cache') ||
    haystack.includes('could not find') ||
    haystack.includes('does not exist') ||
    haystack.includes('relation') ||
    haystack.includes('42p01')
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const anyErr = error as { code?: unknown; message?: unknown };
  const code = typeof anyErr.code === 'string' ? anyErr.code : '';
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  return code === '23505' || /duplicate key/i.test(message);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return String(error);
}

type MobileAttemptReadRow = {
  id: string;
  channel: 'whatsapp' | 'sms';
  fallback_for_attempt_id: string | null;
  provider: SmsDeliveryProvider;
  provider_message_id: string | null;
  recipient_phone: string;
  status: string;
  occurred_at: string;
  updated_at: string;
  mobile_notifications: {
    id: string;
    booking_id: string | null;
    notification_type: string;
    restaurant_id: string;
  };
};

const MOBILE_NOTIFICATION_ATTEMPT_SELECT =
  'id,channel,fallback_for_attempt_id,provider,provider_message_id,recipient_phone,status,occurred_at,updated_at,mobile_notifications!inner(id,booking_id,notification_type,restaurant_id)';

function normalizeMobileStatus(status: string): SmsDeliveryStatus {
  if (status === 'read') return 'delivered';
  if (status === 'accepted' || status === 'claimed') return 'queued';
  if (SMS_DELIVERY_STATUS_VALUES.includes(status as SmsDeliveryStatus)) {
    return status as SmsDeliveryStatus;
  }
  return 'queued';
}

function toEntryDto(row: SmsDeliveryLogRow): SmsDeliveryLogEntry {
  return {
    id: row.id,
    bookingId: row.booking_id ?? null,
    restaurantId: row.restaurant_id ?? null,
    smsType: row.sms_type ?? null,
    recipientPhone: row.recipient_phone,
    messageSid: row.message_sid,
    status: row.status as SmsDeliveryStatus,
    provider: (row.provider as SmsDeliveryProvider | null) ?? null,
    occurredAt: row.occurred_at,
    error: row.error ?? null,
    metadata: row.metadata ?? null,
    channel: 'sms',
    providerStatus: row.status,
  };
}

function toMobileAttemptEventDto(row: MobileAttemptReadRow): SmsDeliveryEventDTO {
  return {
    id: row.id,
    bookingId: row.mobile_notifications.booking_id,
    restaurantId: row.mobile_notifications.restaurant_id,
    smsType: row.mobile_notifications.notification_type,
    recipientPhone: row.recipient_phone,
    messageSid: row.provider_message_id ?? `attempt:${row.id}`,
    status: normalizeMobileStatus(row.status),
    provider: row.provider,
    occurredAt: row.updated_at,
    error: null,
    metadata: null,
    channel: row.channel,
    fallbackForAttemptId: row.fallback_for_attempt_id,
    logicalNotificationId: row.mobile_notifications.id,
    providerStatus: row.status,
  };
}

/**
 * The mobile ledger only persists the current attempt status; there is no
 * append-only history table. When an attempt has moved on from its initial
 * `claimed` state (occurred_at !== updated_at), synthesize a leading
 * "claimed" event so the timeline shows at least a start and current state
 * instead of a single point-in-time entry.
 */
function buildMobileAttemptEvents(row: MobileAttemptReadRow): SmsDeliveryEventDTO[] {
  const current = toMobileAttemptEventDto(row);
  if (!row.occurred_at || row.occurred_at === row.updated_at || row.status === 'claimed') {
    return [current];
  }
  const claimed: SmsDeliveryEventDTO = {
    ...current,
    id: `${row.id}:claimed`,
    status: normalizeMobileStatus('claimed'),
    providerStatus: 'claimed',
    occurredAt: row.occurred_at,
  };
  return [claimed, current];
}

function toMobileAttemptCandidate(row: MobileAttemptReadRow): MobileDeliveryAttemptCandidate {
  const currentStatus = normalizeMobileStatus(row.status);
  return {
    attemptId: row.id,
    providerMessageId: row.provider_message_id,
    aggregate: {
      bookingId: row.mobile_notifications.booking_id,
      channel: row.channel,
      currentEventId: row.id,
      currentOccurredAt: row.updated_at,
      currentProviderStatus: row.status,
      currentStatus,
      events: buildMobileAttemptEvents(row),
      fallbackForAttemptId: row.fallback_for_attempt_id,
      logicalNotificationId: row.mobile_notifications.id,
      messageSid: row.provider_message_id ?? `attempt:${row.id}`,
      provider: row.provider,
      recipientPhone: row.recipient_phone,
      smsType: row.mobile_notifications.notification_type,
    },
  };
}

async function findExistingSmsDeliveryLogEvent(params: {
  messageSid: string;
  recipientPhone: string;
  status: SmsDeliveryStatus;
}): Promise<SmsDeliveryLogEntry | null> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('sms_delivery_log')
    .select(SMS_DELIVERY_LOG_SELECT)
    .eq('message_sid', params.messageSid)
    .eq('recipient_phone', params.recipientPhone)
    .eq('status', params.status)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[sms][delivery-log] duplicate readback failed', { message: error.message });
    return null;
  }

  return data ? toEntryDto(data as SmsDeliveryLogRow) : null;
}

export async function recordSmsDeliveryLog(
  params: InsertParams,
): Promise<SmsDeliveryLogEntry | null> {
  const normalizedPhone = normalizePhone(params.recipientPhone);
  if (!normalizedPhone) {
    return null;
  }

  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('sms_delivery_log')
      .upsert(
        {
          booking_id: params.bookingId ?? null,
          restaurant_id: params.restaurantId ?? null,
          sms_type: params.smsType ?? null,
          recipient_phone: normalizedPhone,
          message_sid: params.messageSid,
          status: params.status,
          provider: params.provider,
          provider_event_id: params.providerEventId ?? null,
          occurred_at: params.occurredAt ?? undefined,
          error: params.error ?? null,
          metadata: params.metadata ?? null,
        },
        // Idempotent on the (message_sid, recipient_phone, status) unique key.
        // Duplicate Twilio status callbacks now DO NOTHING at the DB level
        // instead of raising a 23505 that Postgres logs as an error each time.
        { onConflict: 'message_sid,recipient_phone,status', ignoreDuplicates: true },
      )
      .select(SMS_DELIVERY_LOG_SELECT)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      // ON CONFLICT DO NOTHING skipped the insert: return the existing row.
      return findExistingSmsDeliveryLogEvent({
        messageSid: params.messageSid,
        recipientPhone: normalizedPhone,
        status: params.status,
      });
    }

    return toEntryDto(data as SmsDeliveryLogRow);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return findExistingSmsDeliveryLogEvent({
        messageSid: params.messageSid,
        recipientPhone: normalizedPhone,
        status: params.status,
      });
    }

    await recordObservabilityEvent({
      source: 'sms.delivery_log',
      eventType: 'insert_failed',
      severity: 'warning',
      context: {
        status: params.status,
        provider: params.provider,
        bookingId: params.bookingId ?? null,
        restaurantId: params.restaurantId ?? null,
        error: getErrorMessage(error),
      },
      restaurantId: params.restaurantId ?? undefined,
      bookingId: params.bookingId ?? undefined,
    });

    return null;
  }
}

export async function findLatestSmsDeliveryByMessageSid(params: {
  messageSid: string;
  recipientPhone?: string | null;
}): Promise<{
  bookingId: string | null;
  restaurantId: string | null;
  smsType: string | null;
} | null> {
  const supabase = getServiceSupabaseClient();
  let query = supabase
    .from('sms_delivery_log')
    .select('booking_id, restaurant_id, sms_type')
    .eq('message_sid', params.messageSid)
    .order('occurred_at', { ascending: false })
    .limit(1);

  const normalizedPhone = normalizePhone(params.recipientPhone);
  if (normalizedPhone) {
    query = query.eq('recipient_phone', normalizedPhone);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn('[sms][delivery-log] lookup failed', { message: error.message });
    return null;
  }

  if (!data) return null;

  return {
    bookingId: (data.booking_id as string | null) ?? null,
    restaurantId: (data.restaurant_id as string | null) ?? null,
    smsType: (data.sms_type as string | null) ?? null,
  };
}

export async function hasRecentSmsDelivery(params: {
  bookingId: string;
  smsType: string;
  recipientPhone?: string | null;
  statuses?: ReadonlyArray<SmsDeliveryStatus>;
  withinMs?: number;
}): Promise<boolean> {
  const withinMs =
    typeof params.withinMs === 'number' && params.withinMs > 0
      ? params.withinMs
      : 30 * 24 * 60 * 60 * 1000;
  const statuses = params.statuses?.length
    ? params.statuses
    : (['queued', 'sent', 'delivered'] as const);
  const sinceIso = new Date(Date.now() - withinMs).toISOString();
  const normalizedPhone = normalizePhone(params.recipientPhone);
  if (params.recipientPhone !== undefined && !normalizedPhone) {
    return false;
  }

  const supabase = getServiceSupabaseClient();
  let query = supabase
    .from('sms_delivery_log')
    .select('id')
    .eq('booking_id', params.bookingId)
    .eq('sms_type', params.smsType)
    .in('status', statuses as string[])
    .gte('occurred_at', sinceIso);

  if (normalizedPhone) {
    query = query.eq('recipient_phone', normalizedPhone);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    console.warn('[sms][delivery-log] recent-check failed', { message: error.message });
    return false;
  }

  return (data ?? []).length > 0;
}

export async function listSmsDeliveryEventsForBooking(params: {
  bookingId: string;
  limit?: number;
}): Promise<SmsDeliveryEventDTO[]> {
  const limit =
    typeof params.limit === 'number' && Number.isFinite(params.limit)
      ? Math.max(1, Math.min(200, Math.floor(params.limit)))
      : 50;

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('sms_delivery_log')
    .select(
      'id, booking_id, restaurant_id, sms_type, recipient_phone, message_sid, status, provider, provider_event_id, occurred_at, error, metadata',
    )
    .eq('booking_id', params.bookingId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      throw new SmsDeliveryLogUnavailableError();
    }
    throw new Error(`Failed to load SMS delivery events (${error.code ?? 'unknown'}).`);
  }

  const smsLogEvents: SmsDeliveryEventDTO[] = (data ?? []).map((row) =>
    toEntryDto(row as SmsDeliveryLogRow),
  );

  const { data: mobileRows, error: mobileError } = await supabase
    .from('mobile_notification_attempts')
    .select(MOBILE_NOTIFICATION_ATTEMPT_SELECT)
    .eq('mobile_notifications.booking_id', params.bookingId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  const mobileAttempts = mobileError
    ? []
    : ((mobileRows as MobileAttemptReadRow[] | null | undefined) ?? []).map(
        toMobileAttemptCandidate,
      );
  const events = aggregateSmsDeliveryAttempts({ mobileAttempts, smsLogEvents }).flatMap(
    (attempt) => attempt.events,
  );

  events.sort((a, b) => parseIsoMs(b.occurredAt) - parseIsoMs(a.occurredAt));
  return events.slice(0, limit);
}

type BookingSnapshotRow = {
  id: string;
  reference: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  customer_name: string | null;
  party_size: number | null;
};

type ListSmsDeliveryAttemptsForRestaurantParams = {
  restaurantId: string;
  range: OpsSmsDeliveryRange;
  page?: number;
  pageSize?: number;
  statuses?: ReadonlyArray<SmsDeliveryStatus>;
  channel?: SmsDeliveryChannelFilter;
};

function resolveChannelFilter(
  channel: SmsDeliveryChannelFilter | undefined,
): 'whatsapp' | 'sms' | null {
  return channel && channel !== 'all' ? channel : null;
}

function resolveRangeStartIso(range: OpsSmsDeliveryRange): string {
  const now = Date.now();
  const lookbackMs =
    range === '24h'
      ? 24 * 60 * 60 * 1000
      : range === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
  return new Date(now - lookbackMs).toISOString();
}

function normalizePage(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

function normalizePageSize(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 50;
  return Math.max(1, Math.min(200, Math.floor(raw)));
}

function parseIsoMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function toBookingDto(row: BookingSnapshotRow): NonNullable<OpsSmsDeliveryAttemptDTO['booking']> {
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

const SMS_STALE_THRESHOLD_MS = SMS_DELIVERY_STALE_THRESHOLD_MINUTES * 60 * 1000;
const SMS_IN_FLIGHT_STATUS_SET: ReadonlySet<SmsDeliveryStatus> = new Set(
  SMS_DELIVERY_IN_FLIGHT_STATUSES,
);

export function computeSmsAttemptStaleness(input: {
  currentStatus: SmsDeliveryStatus;
  currentOccurredAt: string | null;
  now?: number;
}): { isStale: boolean; stuckForMs: number | null } {
  if (!SMS_IN_FLIGHT_STATUS_SET.has(input.currentStatus)) {
    return { isStale: false, stuckForMs: null };
  }
  const occurredMs = parseIsoMs(input.currentOccurredAt);
  if (!occurredMs) return { isStale: false, stuckForMs: null };
  const nowMs = typeof input.now === 'number' ? input.now : Date.now();
  const ageMs = nowMs - occurredMs;
  if (ageMs < SMS_STALE_THRESHOLD_MS) return { isStale: false, stuckForMs: null };
  return { isStale: true, stuckForMs: ageMs };
}

function decorateSmsAttemptWithStaleness(
  attempt: OpsSmsDeliveryAttemptDTO,
  now: number,
): OpsSmsDeliveryAttemptDTO {
  const staleness = computeSmsAttemptStaleness({
    currentStatus: attempt.currentStatus,
    currentOccurredAt: attempt.currentOccurredAt,
    now,
  });
  if (!staleness.isStale) return attempt;
  return { ...attempt, isStale: true, stuckForMs: staleness.stuckForMs };
}

/**
 * Loads and merges SMS log rows with mobile (WhatsApp/SMS) ledger rows for a
 * restaurant/range window into a single set of per-attempt aggregates. Both
 * {@link listSmsDeliveryAttemptsForRestaurant} and
 * {@link getSmsDeliveryAttemptsSummary} build on this so channel counts and
 * status breakdowns stay consistent between the feed and the summary cards.
 */
async function fetchSmsAttemptAggregates(params: {
  restaurantId: string;
  sinceIso: string;
}): Promise<SmsDeliveryAttemptAggregate[]> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('sms_delivery_log')
    .select(SMS_DELIVERY_LOG_SELECT)
    .eq('restaurant_id', params.restaurantId)
    .gte('occurred_at', params.sinceIso)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(10_000);

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      throw new SmsDeliveryLogUnavailableError();
    }
    throw new Error(`Failed to load SMS delivery attempts (${error.code ?? 'unknown'}).`);
  }

  const smsLogEvents = ((data as SmsDeliveryLogRow[] | null | undefined) ?? []).map(toEntryDto);

  const { data: mobileRows, error: mobileError } = await supabase
    .from('mobile_notification_attempts')
    .select(MOBILE_NOTIFICATION_ATTEMPT_SELECT)
    .eq('mobile_notifications.restaurant_id', params.restaurantId)
    .gte('updated_at', params.sinceIso)
    .limit(10_000);
  const mobileAttempts = mobileError
    ? []
    : ((mobileRows as MobileAttemptReadRow[] | null | undefined) ?? []).map(
        toMobileAttemptCandidate,
      );

  return aggregateSmsDeliveryAttempts({ mobileAttempts, smsLogEvents });
}

export async function listSmsDeliveryAttemptsForRestaurant(
  params: ListSmsDeliveryAttemptsForRestaurantParams,
): Promise<{
  attempts: OpsSmsDeliveryAttemptDTO[];
  hasNext: boolean;
  page: number;
  pageSize: number;
}> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const start = (page - 1) * pageSize;
  const sinceIso = resolveRangeStartIso(params.range);
  const statusFilter = params.statuses?.length ? new Set(params.statuses) : null;
  const channelFilter = resolveChannelFilter(params.channel);

  const supabase = getServiceSupabaseClient();
  const rawAggregates = await fetchSmsAttemptAggregates({
    restaurantId: params.restaurantId,
    sinceIso,
  });

  const aggregates = rawAggregates
    .filter((attempt) => (statusFilter ? statusFilter.has(attempt.currentStatus) : true))
    .filter((attempt) => (channelFilter ? attempt.channel === channelFilter : true))
    .sort((a, b) => parseIsoMs(b.currentOccurredAt) - parseIsoMs(a.currentOccurredAt));

  const pageSlice = aggregates.slice(start, start + pageSize + 1);
  const hasNext = pageSlice.length > pageSize;
  const selected = hasNext ? pageSlice.slice(0, pageSize) : pageSlice;

  const bookingIds = Array.from(
    new Set(selected.map((attempt) => attempt.bookingId).filter((id): id is string => Boolean(id))),
  );
  let bookingById = new Map<string, NonNullable<OpsSmsDeliveryAttemptDTO['booking']>>();
  if (bookingIds.length > 0) {
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, reference, booking_date, start_time, end_time, customer_name, party_size')
      .in('id', bookingIds);
    if (!bookingsError) {
      bookingById = new Map(
        ((bookings as BookingSnapshotRow[] | null | undefined) ?? []).map((booking) => [
          booking.id,
          toBookingDto(booking),
        ]),
      );
    }
  }

  const now = Date.now();
  const attempts: OpsSmsDeliveryAttemptDTO[] = selected.map((attempt) =>
    decorateSmsAttemptWithStaleness(
      {
        messageSid: attempt.messageSid,
        recipientPhone: attempt.recipientPhone,
        bookingId: attempt.bookingId,
        smsType: attempt.smsType,
        provider: attempt.provider,
        currentStatus: attempt.currentStatus,
        currentProviderStatus: attempt.currentProviderStatus,
        currentOccurredAt: attempt.currentOccurredAt,
        events: attempt.events
          .slice()
          .sort(
            (a, b) =>
              parseIsoMs(a.occurredAt) - parseIsoMs(b.occurredAt) || a.id.localeCompare(b.id),
          ),
        booking: attempt.bookingId ? (bookingById.get(attempt.bookingId) ?? null) : null,
        channel: attempt.channel ?? 'sms',
        logicalNotificationId: attempt.logicalNotificationId ?? null,
        fallbackForAttemptId: attempt.fallbackForAttemptId ?? null,
      },
      now,
    ),
  );

  return { attempts, hasNext, page, pageSize };
}

export async function getSmsDeliveryAttemptsSummary(params: {
  restaurantId: string;
  range: OpsSmsDeliveryRange;
  statuses?: ReadonlyArray<SmsDeliveryStatus>;
  channel?: SmsDeliveryChannelFilter;
}): Promise<OpsSmsDeliverySummary> {
  const sinceIso = resolveRangeStartIso(params.range);
  const statusFilter = params.statuses?.length ? new Set(params.statuses) : null;
  const channelFilter = resolveChannelFilter(params.channel);

  const rawAggregates = await fetchSmsAttemptAggregates({
    restaurantId: params.restaurantId,
    sinceIso,
  });

  const finalAttempts = rawAggregates
    .filter((attempt) => (statusFilter ? statusFilter.has(attempt.currentStatus) : true))
    .filter((attempt) => (channelFilter ? attempt.channel === channelFilter : true));

  const total = finalAttempts.length;
  const queued = finalAttempts.filter((attempt) => attempt.currentStatus === 'queued').length;
  const sent = finalAttempts.filter((attempt) => attempt.currentStatus === 'sent').length;
  const delivered = finalAttempts.filter((attempt) => attempt.currentStatus === 'delivered').length;
  const undelivered = finalAttempts.filter(
    (attempt) => attempt.currentStatus === 'undelivered',
  ).length;
  const failed = finalAttempts.filter((attempt) => attempt.currentStatus === 'failed').length;
  const uniqueRecipients = new Set(finalAttempts.map((attempt) => attempt.recipientPhone)).size;
  const uniqueBookings = new Set(
    finalAttempts
      .map((attempt) => attempt.bookingId)
      .filter((bookingId): bookingId is string => Boolean(bookingId)),
  ).size;

  const whatsappCount = finalAttempts.filter((attempt) => attempt.channel === 'whatsapp').length;
  const smsCount = finalAttempts.filter((attempt) => attempt.channel === 'sms').length;
  const fallbackCount = finalAttempts.filter((attempt) =>
    Boolean(attempt.fallbackForAttemptId),
  ).length;

  const nowMs = Date.now();
  const stuckInFlight = finalAttempts.reduce((count, attempt) => {
    const { isStale } = computeSmsAttemptStaleness({
      currentStatus: attempt.currentStatus,
      currentOccurredAt: attempt.currentOccurredAt,
      now: nowMs,
    });
    return isStale ? count + 1 : count;
  }, 0);

  const terminalAttempts = delivered + undelivered + failed;

  return {
    total,
    queued,
    sent,
    delivered,
    undelivered,
    failed,
    deliveredRate: terminalAttempts > 0 ? delivered / terminalAttempts : 0,
    failureRate: terminalAttempts > 0 ? (undelivered + failed) / terminalAttempts : 0,
    uniqueRecipients,
    uniqueBookings,
    stuckInFlight,
    whatsappCount,
    smsCount,
    fallbackCount,
  };
}
