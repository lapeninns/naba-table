import { normalizePhone } from '@/server/customers';
import { recordObservabilityEvent } from '@/server/observability';
import { getServiceSupabaseClient } from '@/server/supabase';

import type {
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

export async function recordSmsDeliveryLog(params: InsertParams): Promise<SmsDeliveryLogEntry | null> {
  const normalizedPhone = normalizePhone(params.recipientPhone);
  if (!normalizedPhone) {
    return null;
  }

  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('sms_delivery_log')
      .insert({
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
      })
      .select(SMS_DELIVERY_LOG_SELECT)
      .single();

    if (error) {
      throw error;
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
}): Promise<{ bookingId: string | null; restaurantId: string | null; smsType: string | null } | null> {
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

  return (data ?? []).map((row) => toEntryDto(row as SmsDeliveryLogRow));
}
