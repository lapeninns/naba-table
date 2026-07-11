import 'server-only';

import { mapProviderMobileStatus, type MobileAttemptStatus } from '@/server/notifications/mobile';
import { sendClaimedBookingSmsFallback } from '@/server/sms/bookings';
import { getServiceSupabaseClient } from '@/server/supabase';

const TERMINAL_STATUSES = new Set<MobileAttemptStatus>([
  'delivered',
  'read',
  'failed',
  'undelivered',
]);

const STATUS_RANK: Readonly<Record<MobileAttemptStatus, number>> = {
  claimed: 0,
  accepted: 1,
  queued: 2,
  sent: 3,
  delivered: 4,
  read: 5,
  undelivered: 4,
  failed: 4,
};

export function shouldApplyWhatsAppStatus(
  current: MobileAttemptStatus,
  incoming: MobileAttemptStatus,
): boolean {
  if (current === 'delivered' && incoming === 'read') {
    return true;
  }
  if (TERMINAL_STATUSES.has(current)) {
    return false;
  }
  return STATUS_RANK[incoming] >= STATUS_RANK[current];
}

function normalizeWhatsAppRecipient(value: string): string {
  return value.trim().replace(/^whatsapp:/i, '');
}

export async function processWhatsAppStatusCallback({
  errorCode,
  messageSid,
  providerStatus,
  recipientPhone,
}: {
  errorCode: string | null;
  messageSid: string;
  providerStatus: string;
  recipientPhone: string;
}): Promise<{ ignored: boolean; fallbackSent: boolean }> {
  const incoming = mapProviderMobileStatus(providerStatus);
  const client = getServiceSupabaseClient();
  const normalizedRecipient = normalizeWhatsAppRecipient(recipientPhone);
  const { data: attempt, error } = await client
    .from('mobile_notification_attempts')
    .select('id,notification_id,recipient_phone,status')
    .eq('provider', 'twilio')
    .eq('provider_message_id', messageSid)
    .eq('channel', 'whatsapp')
    .maybeSingle();

  if (error) {
    throw new Error('Failed to resolve WhatsApp delivery attempt.');
  }
  if (!attempt || attempt.recipient_phone !== normalizedRecipient) {
    return { ignored: true, fallbackSent: false };
  }

  const current = attempt.status as MobileAttemptStatus;
  if (!shouldApplyWhatsAppStatus(current, incoming)) {
    return { ignored: true, fallbackSent: false };
  }

  const { data: updated, error: updateError } = await client
    .from('mobile_notification_attempts')
    .update({
      error_code: errorCode,
      status: incoming,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attempt.id)
    .eq('status', current)
    .select('id')
    .maybeSingle();
  if (updateError) {
    throw new Error('Failed to update WhatsApp delivery status.');
  }
  if (!updated || (incoming !== 'failed' && incoming !== 'undelivered')) {
    return { ignored: !updated, fallbackSent: false };
  }

  const { data: notification, error: notificationError } = await client
    .from('mobile_notifications')
    .select('restaurant_id,recipient_phone')
    .eq('id', attempt.notification_id)
    .single();
  if (notificationError || !notification) {
    throw new Error('Failed to resolve WhatsApp notification for fallback.');
  }

  const { data: fallbackAttemptId, error: fallbackError } = await client.rpc(
    'claim_mobile_notification_fallback',
    {
      p_fallback_for_attempt_id: attempt.id,
      p_notification_id: attempt.notification_id,
      p_recipient_phone: notification.recipient_phone,
      p_restaurant_id: notification.restaurant_id,
    },
  );
  if (fallbackError) {
    throw new Error('Failed to claim WhatsApp SMS fallback.');
  }
  if (!fallbackAttemptId) {
    return { ignored: false, fallbackSent: false };
  }

  const fallbackSent = await sendClaimedBookingSmsFallback({
    attemptId: fallbackAttemptId,
    notificationId: attempt.notification_id,
  });
  return { ignored: false, fallbackSent };
}
