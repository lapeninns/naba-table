import { recordObservabilityEvent } from '@/server/observability';
import { getServiceSupabaseClient } from '@/server/supabase';

import type {
  EmailDeliveryEventDTO,
  EmailDeliveryProvider,
  OpsEmailDeliveryRange,
  EmailDeliveryStatus,
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

export async function listEmailDeliveryEventsForRestaurant(params: {
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
}): Promise<{ events: EmailDeliveryEventDTO[]; hasNext: boolean; page: number; pageSize: number }> {
  const rawPage = typeof params.page === 'number' && Number.isFinite(params.page) ? params.page : 1;
  const rawPageSize =
    typeof params.pageSize === 'number' && Number.isFinite(params.pageSize) ? params.pageSize : 50;

  const page = Math.max(1, Math.floor(rawPage));
  const pageSize = Math.max(1, Math.min(200, Math.floor(rawPageSize)));

  const now = Date.now();
  const withinMs =
    params.range === '24h'
      ? 24 * 60 * 60 * 1000
      : params.range === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;

  const sinceIso = new Date(now - withinMs).toISOString();

  const supabase = getServiceSupabaseClient();

  let bookingIdsFilter: string[] | null = null;
  const bookingRef = params.bookingRef?.trim();
  if (bookingRef) {
    const { data: rows, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('restaurant_id', params.restaurantId)
      .eq('reference', bookingRef)
      .limit(20);

    if (error) {
      throw new Error('Failed to resolve booking reference.');
    }

    const ids =
      (rows as Array<{ id: string }> | null | undefined)
        ?.map((row) => row.id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0) ?? [];

    if (ids.length === 0) {
      return { events: [], hasNext: false, page, pageSize };
    }

    bookingIdsFilter = ids;
  }

  const offset = (page - 1) * pageSize;
  // Supabase range() is inclusive, so offset..offset+pageSize returns pageSize+1 rows.
  const rangeTo = offset + pageSize;

  let query = supabase
    .from('email_delivery_log')
    .select(
      'id, booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, provider, occurred_at, error, metadata',
    )
    .eq('restaurant_id', params.restaurantId)
    .gte('occurred_at', sinceIso)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, rangeTo);

  if (bookingIdsFilter) {
    query = query.in('booking_id', bookingIdsFilter);
  }

  const statuses = params.statuses?.length ? params.statuses : null;
  if (statuses) {
    query = query.in('status', statuses as string[]);
  }

  const recipientEmail = params.recipientEmail?.trim();
  if (recipientEmail) {
    // No wildcards: exact match, case-insensitive.
    query = query.ilike('recipient_email', recipientEmail);
  }

  const messageId = params.messageId?.trim();
  if (messageId) {
    query = query.eq('message_id', messageId);
  }

  const templateType = params.templateType?.trim();
  if (templateType) {
    query = query.eq('template_type', templateType);
  }

  const emailType = params.emailType?.trim();
  if (emailType) {
    query = query.eq('email_type', emailType);
  }

  const { data, error } = await query;

  if (error) {
    if (isDeliveryLogUnavailable(error)) {
      throw new EmailDeliveryLogUnavailableError();
    }
    throw new Error(`Failed to load email delivery events (${error.code ?? 'unknown'}).`);
  }

  const rows = (data as EmailDeliveryLogRow[] | null | undefined) ?? [];
  const hasNext = rows.length > pageSize;
  const pageRows = hasNext ? rows.slice(0, pageSize) : rows;

  return {
    events: pageRows.map(toEventDto),
    hasNext,
    page,
    pageSize,
  };
}
