import 'server-only';

import {
  mapProviderMobileStatus,
  type MobileAttemptStatus,
  type MobileNotificationType,
} from '@/server/notifications/mobile';
import { accelerateReviewEmailFollowup, recordReviewRequestEvent } from '@/server/reviews/journeys';
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

type WhatsAppStatusInput = {
  readonly attemptId?: string;
  readonly errorCode: string | null;
  readonly messageSid: string;
  readonly providerStatus: string;
  readonly recipientPhone: string;
};

type WhatsAppAttemptLookup = {
  readonly id: string;
  readonly notificationId: string;
  readonly notificationType: MobileNotificationType;
  readonly notificationRecipientPhone: string;
  readonly recipientPhone: string;
  readonly restaurantId: string;
  readonly reviewRequestId?: string | null;
  readonly status: MobileAttemptStatus;
};

export type WhatsAppStatusDependencies = {
  readonly claimFallback: (input: {
    readonly notificationId: string;
    readonly recipientPhone: string;
    readonly restaurantId: string;
    readonly whatsappAttemptId: string;
  }) => Promise<string | null>;
  readonly findAttempt: (
    messageSid: string,
    attemptId: string | null,
  ) => Promise<WhatsAppAttemptLookup | null>;
  readonly sendFallback: (input: {
    readonly attemptId: string;
    readonly notificationId: string;
  }) => Promise<boolean>;
  readonly updateAttempt: (input: {
    readonly attemptId: string;
    readonly currentStatus: MobileAttemptStatus;
    readonly errorCode: string | null;
    readonly providerMessageId: string;
    readonly status: MobileAttemptStatus;
  }) => Promise<boolean>;
  readonly recordStatus?: (input: {
    readonly messageSid: string;
    readonly restaurantId: string;
    readonly reviewRequestId: string;
    readonly status: MobileAttemptStatus;
  }) => Promise<void>;
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

function parseMobileNotificationType(value: string): MobileNotificationType | null {
  switch (value) {
    case 'booking_confirmation':
    case 'booking_update':
    case 'booking_cancellation':
    case 'restaurant_cancellation':
    case 'booking_review_request':
    case 'manager_daily_summary':
      return value;
    default:
      return null;
  }
}

function parseMobileAttemptStatus(value: string): MobileAttemptStatus | null {
  switch (value) {
    case 'claimed':
    case 'accepted':
    case 'queued':
    case 'sent':
    case 'delivered':
    case 'read':
    case 'undelivered':
    case 'failed':
      return value;
    default:
      return null;
  }
}

export async function reconcileWhatsAppStatusWithDependencies(
  { attemptId, errorCode, messageSid, providerStatus, recipientPhone }: WhatsAppStatusInput,
  dependencies: WhatsAppStatusDependencies,
): Promise<{ ignored: boolean; fallbackSent: boolean }> {
  const incoming = mapProviderMobileStatus(providerStatus);
  const normalizedRecipient = normalizeWhatsAppRecipient(recipientPhone);
  const attempt = await dependencies.findAttempt(messageSid, attemptId ?? null);
  if (!attempt || attempt.recipientPhone !== normalizedRecipient) {
    return { ignored: true, fallbackSent: false };
  }
  if (!shouldApplyWhatsAppStatus(attempt.status, incoming)) {
    return { ignored: true, fallbackSent: false };
  }

  const updated = await dependencies.updateAttempt({
    attemptId: attempt.id,
    currentStatus: attempt.status,
    errorCode,
    providerMessageId: messageSid,
    status: incoming,
  });
  if (!updated || (incoming !== 'failed' && incoming !== 'undelivered')) {
    if (
      updated &&
      attempt.notificationType === 'booking_review_request' &&
      attempt.reviewRequestId
    ) {
      await dependencies.recordStatus?.({
        messageSid,
        restaurantId: attempt.restaurantId,
        reviewRequestId: attempt.reviewRequestId,
        status: incoming,
      });
    }
    return { ignored: !updated, fallbackSent: false };
  }
  if (attempt.notificationType === 'booking_review_request') {
    if (attempt.reviewRequestId) {
      await dependencies.recordStatus?.({
        messageSid,
        restaurantId: attempt.restaurantId,
        reviewRequestId: attempt.reviewRequestId,
        status: incoming,
      });
    }
    return { ignored: false, fallbackSent: false };
  }

  const fallbackAttemptId = await dependencies.claimFallback({
    notificationId: attempt.notificationId,
    recipientPhone: attempt.notificationRecipientPhone,
    restaurantId: attempt.restaurantId,
    whatsappAttemptId: attempt.id,
  });
  if (!fallbackAttemptId) {
    return { ignored: false, fallbackSent: false };
  }

  const fallbackSent = await dependencies.sendFallback({
    attemptId: fallbackAttemptId,
    notificationId: attempt.notificationId,
  });
  return { ignored: false, fallbackSent };
}

export async function processWhatsAppStatusCallback(
  input: WhatsAppStatusInput,
): Promise<{ ignored: boolean; fallbackSent: boolean }> {
  const client = getServiceSupabaseClient();

  return reconcileWhatsAppStatusWithDependencies(input, {
    findAttempt: async (messageSid, attemptId) => {
      let query = client
        .from('mobile_notification_attempts')
        .select('id,notification_id,recipient_phone,status')
        .eq('provider', 'twilio')
        .eq('channel', 'whatsapp');
      query = attemptId
        ? query
            .eq('id', attemptId)
            .or(`provider_message_id.is.null,provider_message_id.eq.${messageSid}`)
        : query.eq('provider_message_id', messageSid);
      const { data: attempt, error } = await query.maybeSingle();
      if (error) {
        throw new Error('Failed to resolve WhatsApp delivery attempt.');
      }
      if (!attempt) {
        return null;
      }

      const { data: notification, error: notificationError } = await client
        .from('mobile_notifications')
        .select('notification_type,restaurant_id,recipient_phone,review_request_id')
        .eq('id', attempt.notification_id)
        .single();
      if (notificationError || !notification) {
        throw new Error('Failed to resolve WhatsApp notification.');
      }
      const notificationType = parseMobileNotificationType(notification.notification_type);
      if (!notificationType) {
        throw new Error('WhatsApp notification type is unsupported.');
      }
      const status = parseMobileAttemptStatus(attempt.status);
      if (!status) {
        throw new Error('WhatsApp attempt status is unsupported.');
      }

      return {
        id: attempt.id,
        notificationId: attempt.notification_id,
        notificationRecipientPhone: notification.recipient_phone,
        notificationType,
        recipientPhone: attempt.recipient_phone,
        restaurantId: notification.restaurant_id,
        reviewRequestId: notification.review_request_id,
        status,
      };
    },
    updateAttempt: async ({ attemptId, errorCode, providerMessageId, status }) => {
      const { data: persistedStatus, error } = await client.rpc(
        'finalize_mobile_whatsapp_attempt',
        {
          p_attempt_id: attemptId,
          p_error_code: errorCode,
          p_provider_message_id: providerMessageId,
          p_status: status,
        },
      );
      if (error) {
        throw new Error('Failed to update WhatsApp delivery status.');
      }
      return persistedStatus === status;
    },
    claimFallback: async ({ notificationId, recipientPhone, restaurantId, whatsappAttemptId }) => {
      const { data, error } = await client.rpc('claim_mobile_notification_fallback', {
        p_fallback_for_attempt_id: whatsappAttemptId,
        p_notification_id: notificationId,
        p_recipient_phone: recipientPhone,
        p_restaurant_id: restaurantId,
      });
      if (error) {
        throw new Error('Failed to claim WhatsApp SMS fallback.');
      }
      return data;
    },
    sendFallback: ({ attemptId, notificationId }) =>
      sendClaimedBookingSmsFallback({ attemptId, notificationId }),
    recordStatus: async ({ messageSid, restaurantId, reviewRequestId, status }) => {
      const eventType =
        status === 'delivered'
          ? 'delivered'
          : status === 'read'
            ? 'read'
            : status === 'failed' || status === 'undelivered'
              ? 'failed'
              : 'sent';
      await recordReviewRequestEvent(
        {
          channel: 'whatsapp',
          eventType,
          idempotencyKey: `twilio:${messageSid}:${status}`,
          occurredAt: new Date().toISOString(),
          provider: 'twilio',
          providerEventId: messageSid,
          restaurantId,
          reviewRequestId,
        },
        client,
      );
      if (status === 'failed' || status === 'undelivered') {
        await accelerateReviewEmailFollowup({ restaurantId, reviewRequestId }, client);
      }
    },
  });
}
