import { recordObservabilityEvent } from '@/server/observability';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Json } from '@/types/supabase';

export type EmailDeliveryStatus =
  | 'sent'
  | 'delivered'
  | 'delivery_delayed'
  | 'bounced'
  | 'complained'
  | 'failed';

export type EmailDeliveryProvider = 'resend' | 'mock';

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

