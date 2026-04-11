import { sendBookingConfirmationEmail } from '@/server/emails/bookings';
import { hasRecentEmailDelivery } from '@/server/emails/email-delivery-log';
import { sendGuestBookingConfirmationSms } from '@/server/sms/bookings';

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
  let hasExistingConfirmationEmail = false;

  if (hasValidRecipientEmail) {
    hasExistingConfirmationEmail = await hasRecentEmailDelivery({
      bookingId: booking.id,
      templateType: 'confirmation',
      withinMs: CONFIRMATION_DEDUPE_WINDOW_MS,
    });
  }

  let emailSent = false;
  let smsSent = false;

  if (hasValidRecipientEmail && !hasExistingConfirmationEmail) {
    await sendBookingConfirmationEmail(booking);
    emailSent = true;
  }

  const smsResult = allowSms ? await sendGuestBookingConfirmationSms(booking) : null;
  smsSent = Boolean(smsResult?.messageSid || smsResult?.status);

  return {
    alreadySent: hasExistingConfirmationEmail,
    emailSent,
    smsSent,
  };
}
