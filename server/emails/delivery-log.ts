import { EMAIL_DELIVERY_STATUSES, type EmailDeliveryStatus } from '@/lib/emails/delivery-status';
import { getServiceSupabaseClient } from '@/server/supabase';

export { EMAIL_DELIVERY_STATUSES, type EmailDeliveryStatus };

export type EmailDeliveryLogInput = {
  bookingId: string | null;
  restaurantId: string | null;
  emailType: string | null;
  templateType: string | null;
  recipientEmail: string;
  messageId: string;
  status: EmailDeliveryStatus;
  occurredAt?: string | null;
  providerEventId?: string | null;
  provider?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordEmailDeliveryEvent(input: EmailDeliveryLogInput): Promise<void> {
  const supabase = getServiceSupabaseClient();

  const payload = {
    booking_id: input.bookingId,
    restaurant_id: input.restaurantId,
    email_type: input.emailType,
    template_type: input.templateType,
    recipient_email: input.recipientEmail,
    message_id: input.messageId,
    status: input.status,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    provider_event_id: input.providerEventId,
    provider: input.provider ?? 'resend',
    error: input.error,
    metadata: input.metadata ?? null,
  };

  const { error } = await supabase
    .from('email_delivery_log')
    .upsert(payload, { onConflict: 'message_id,recipient_email,status' });

  if (error) {
    throw new Error(`[email_delivery_log] ${error.message}`);
  }
}

export async function cleanupEmailDeliveryLogs(params: { cutoffIso: string }): Promise<number> {
  const supabase = getServiceSupabaseClient();
  const { error, count } = await supabase
    .from('email_delivery_log')
    .delete({ count: 'exact' })
    .lt('occurred_at', params.cutoffIso);

  if (error) {
    throw new Error(`[email_delivery_log] ${error.message}`);
  }

  return count ?? 0;
}
