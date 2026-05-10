import { sendBookingConfirmationEmail } from '@/server/emails/bookings';
import { hasRecentEmailDelivery } from '@/server/emails/email-delivery-log';
import { sendGuestBookingConfirmationSms } from '@/server/sms/bookings';
import { hasRecentSmsDelivery } from '@/server/sms/delivery-log';

import type { BookingRecord } from '@/server/bookings';

const CONFIRMATION_DEDUPE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 3 && value.includes('@'));
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

  if (hasValidRecipientEmail && !hasExistingConfirmationEmail) {
    await sendBookingConfirmationEmail(booking);
    emailSent = true;
  }

  const smsResult =
    hasValidRecipientSms && !hasExistingConfirmationSms
      ? await sendGuestBookingConfirmationSms(booking)
      : null;
  smsSent = Boolean(smsResult?.messageSid || smsResult?.status);

  return {
    alreadySent: hasExistingConfirmationEmail || hasExistingConfirmationSms,
    emailSent,
    smsSent,
  };
}
