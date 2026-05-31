import { sendBookingConfirmationEmail } from '@/server/emails/bookings';
import { hasRecentEmailDelivery } from '@/server/emails/email-delivery-log';
import { sendGuestBookingConfirmationSms } from '@/server/sms/bookings';
import { hasRecentSmsDelivery } from '@/server/sms/delivery-log';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';

const CONFIRMATION_DEDUPE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

type ConfirmationNotificationChannel = 'email' | 'sms';

type ConfirmationNotificationClaimError = {
  code?: string | null;
  message?: string | null;
};

type ConfirmationNotificationClaimClient = {
  from: (table: 'booking_confirmation_notification_claims') => {
    insert: (row: {
      booking_id: string;
      restaurant_id: string | null;
      channel: ConfirmationNotificationChannel;
    }) => PromiseLike<{ error: ConfirmationNotificationClaimError | null }>;
  };
};

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 3 && value.includes('@'));
}

function isDuplicateClaimError(error: ConfirmationNotificationClaimError): boolean {
  return (
    error.code === '23505' || /duplicate key|unique constraint/i.test(error.message ?? '')
  );
}

async function claimFirstConfirmationNotification(params: {
  bookingId: string;
  restaurantId?: string | null;
  channel: ConfirmationNotificationChannel;
}): Promise<boolean> {
  const supabase =
    getServiceSupabaseClient() as unknown as ConfirmationNotificationClaimClient;
  const { error } = await supabase.from('booking_confirmation_notification_claims').insert({
    booking_id: params.bookingId,
    restaurant_id: params.restaurantId ?? null,
    channel: params.channel,
  });

  if (!error) {
    return true;
  }

  if (isDuplicateClaimError(error)) {
    return false;
  }

  console.warn('[booking.confirmation-notifications] claim failed', {
    channel: params.channel,
    code: error.code ?? null,
  });
  return false;
}

export type FirstConfirmationDispatchResult = {
  alreadySent: boolean;
  emailSent: boolean;
  smsSent: boolean;
};

export async function sendFirstBookingConfirmationNotifications(
  booking: BookingRecord,
  options?: {
    allowEmail?: boolean;
    allowSms?: boolean;
  },
): Promise<FirstConfirmationDispatchResult> {
  const allowEmail = options?.allowEmail !== false;
  const allowSms = options?.allowSms !== false;
  const hasValidRecipientEmail = allowEmail && isValidEmail(booking.customer_email);
  const hasValidRecipientSms = allowSms && Boolean(booking.customer_phone?.trim());
  let hasExistingConfirmationEmail = false;
  let hasExistingConfirmationSms = false;

  if (hasValidRecipientEmail) {
    hasExistingConfirmationEmail = await hasRecentEmailDelivery({
      bookingId: booking.id,
      templateType: 'confirmation',
      withinMs: CONFIRMATION_DEDUPE_WINDOW_MS,
    });
  }

  if (hasValidRecipientSms) {
    hasExistingConfirmationSms = await hasRecentSmsDelivery({
      bookingId: booking.id,
      smsType: 'booking_confirmation',
      recipientPhone: booking.customer_phone,
      withinMs: CONFIRMATION_DEDUPE_WINDOW_MS,
    });
  }

  let emailSent = false;
  let smsSent = false;
  let emailClaimedElsewhere = false;
  let smsClaimedElsewhere = false;

  if (hasValidRecipientEmail && !hasExistingConfirmationEmail) {
    const claimed = await claimFirstConfirmationNotification({
      bookingId: booking.id,
      restaurantId: booking.restaurant_id,
      channel: 'email',
    });
    if (claimed) {
      await sendBookingConfirmationEmail(booking);
      emailSent = true;
    } else {
      emailClaimedElsewhere = true;
    }
  }

  if (hasValidRecipientSms && !hasExistingConfirmationSms) {
    const claimed = await claimFirstConfirmationNotification({
      bookingId: booking.id,
      restaurantId: booking.restaurant_id,
      channel: 'sms',
    });
    if (claimed) {
      const smsResult = await sendGuestBookingConfirmationSms(booking);
      smsSent = Boolean(smsResult?.messageSid || smsResult?.status);
    } else {
      smsClaimedElsewhere = true;
    }
  }

  return {
    alreadySent:
      hasExistingConfirmationEmail ||
      hasExistingConfirmationSms ||
      emailClaimedElsewhere ||
      smsClaimedElsewhere,
    emailSent,
    smsSent,
  };
}
