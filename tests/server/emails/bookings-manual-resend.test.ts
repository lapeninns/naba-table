import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn());
const getServiceSupabaseClient = vi.hoisted(() => vi.fn());
const recordEmailDeliveryLog = vi.hoisted(() => vi.fn());
const hasRecentEmailDelivery = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

vi.mock('@/config', () => ({
  default: {
    appName: 'Nab a Table',
    auth: {
      loginUrl: '/auth',
    },
    email: {
      supportEmail: 'support@nabatable.com',
      platformReplyTo: 'platform@nabatable.com',
    },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    raw: {
      NEXT_PUBLIC_SITE_URL: 'https://www.nabatable.com',
    },
    app: {
      url: 'https://app.nabatable.com',
    },
    security: {
      sessionRecoveryAccessTokenSecret: null,
      sessionRecoveryAccessTokenTtlSeconds: 900,
    },
  },
}));

class SuppressedError extends Error {}

vi.mock('@/libs/resend', () => ({
  sendEmail,
  isEmailRecipientSuppressedError: (error: unknown) => error instanceof SuppressedError,
  createEmailIdempotencyKey: ({ scope, parts }: { scope: string; parts: unknown[] }) =>
    `${scope}:${parts.join(':')}`,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient,
}));

vi.mock('@/server/emails/email-delivery-log', async () => {
  const actual = await vi.importActual<typeof DeliveryLogModule>(
    '@/server/emails/email-delivery-log',
  );
  return {
    EmailDeliveryRetryError: actual.EmailDeliveryRetryError,
    hasRecentEmailDelivery,
    recordEmailDeliveryLog,
  };
});

import {
  BookingEmailSkippedError,
  resendBookingEmailFromDeliveryLog,
  sendBookingConfirmationEmail,
  sendBookingReminderEmail,
} from '@/server/emails/bookings';

import type * as DeliveryLogModule from '@/server/emails/email-delivery-log';

function buildBooking() {
  return {
    id: 'booking-1',
    restaurant_id: 'restaurant-1',
    customer_name: 'Guest One',
    customer_email: 'guest@example.com',
    customer_phone: '+447700900123',
    party_size: 2,
    booking_date: '2026-06-01',
    start_time: '18:00:00',
    end_time: '20:00:00',
    start_at: '2026-06-01T17:00:00.000Z',
    end_at: '2026-06-01T19:00:00.000Z',
    status: 'confirmed',
    reference: 'ABC123',
    booking_type: 'standard',
    seating_preference: 'any',
    notes: null,
    updated_at: '2026-05-11T12:00:00.000Z',
  } as Parameters<typeof sendBookingConfirmationEmail>[0];
}

function buildRestaurant(contactEmail: string | null) {
  return {
    id: 'restaurant-1',
    slug: 'the-venue',
    name: 'The Venue',
    timezone: 'Europe/London',
    address: '1 High Street',
    contact_phone: '+441234567890',
    contact_email: contactEmail,
    booking_policy: '',
    logo_url: null,
    google_map_url: null,
    google_review_url: null,
    email_templates: null,
  };
}

function mockRestaurantLookup(contactEmail: string | null) {
  getServiceSupabaseClient.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: buildRestaurant(contactEmail),
            error: null,
          }),
        })),
      })),
    })),
  });
}

describe('manual resend from the delivery log', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    getServiceSupabaseClient.mockReset();
    recordEmailDeliveryLog.mockReset();
    hasRecentEmailDelivery.mockReset();

    sendEmail.mockResolvedValue({ provider: 'mock', messageId: 'msg_retry' });
    recordEmailDeliveryLog.mockResolvedValue({ id: 'log-2' });
    hasRecentEmailDelivery.mockResolvedValue(false);
    mockRestaurantLookup('venue@restaurant.test');
  });

  it('sends with the retry attempt key instead of the original booking key', async () => {
    await resendBookingEmailFromDeliveryLog({
      booking: buildBooking(),
      emailType: 'created',
      templateType: 'confirmation',
      idempotencyKey: 'booking-email-retry:attempt-2',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'booking-email-retry:attempt-2' }),
    );
  });

  it('keeps the booking-state key for normal sends', async () => {
    await sendBookingConfirmationEmail(buildBooking());

    const [{ idempotencyKey }] = sendEmail.mock.calls[0] as [{ idempotencyKey: string }];
    expect(idempotencyKey.startsWith('booking-email:')).toBe(true);
  });

  it('reports a suppressed recipient instead of pretending nothing happened', async () => {
    sendEmail.mockRejectedValue(new SuppressedError('suppressed'));

    await expect(
      resendBookingEmailFromDeliveryLog({
        booking: buildBooking(),
        emailType: 'created',
        templateType: 'confirmation',
        idempotencyKey: 'k',
      }),
    ).rejects.toBeInstanceOf(SuppressedError);
  });

  it('still skips suppressed recipients silently for automatic sends', async () => {
    sendEmail.mockRejectedValue(new SuppressedError('suppressed'));

    await expect(sendBookingConfirmationEmail(buildBooking())).resolves.toBeNull();
  });

  it('reports a booking without an email address', async () => {
    await expect(
      resendBookingEmailFromDeliveryLog({
        booking: { ...buildBooking(), customer_email: null } as ReturnType<typeof buildBooking>,
        emailType: 'created',
        templateType: 'confirmation',
        idempotencyKey: 'k',
      }),
    ).rejects.toMatchObject({ code: 'MISSING_RECIPIENT' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  describe('manage_link resend', () => {
    it('sends with the retry attempt key, the same key on every retry of that attempt', async () => {
      const first = resendBookingEmailFromDeliveryLog({
        booking: buildBooking(),
        emailType: 'manage_link',
        templateType: 'manage_link',
        idempotencyKey: 'booking-email-retry:attempt-3',
      });
      await first;
      await resendBookingEmailFromDeliveryLog({
        booking: buildBooking(),
        emailType: 'manage_link',
        templateType: 'manage_link',
        idempotencyKey: 'booking-email-retry:attempt-3',
      });

      expect(sendEmail).toHaveBeenCalledTimes(2);
      const keys = sendEmail.mock.calls.map(
        ([params]) => (params as { idempotencyKey: string }).idempotencyKey,
      );
      expect(keys).toEqual(['booking-email-retry:attempt-3', 'booking-email-retry:attempt-3']);
    });

    it('reports a suppressed recipient instead of resolving as sent', async () => {
      sendEmail.mockRejectedValue(new SuppressedError('suppressed'));

      await expect(
        resendBookingEmailFromDeliveryLog({
          booking: buildBooking(),
          emailType: 'manage_link',
          templateType: 'manage_link',
          idempotencyKey: 'k',
        }),
      ).rejects.toBeInstanceOf(SuppressedError);
    });

    it('reports a booking without an email address', async () => {
      await expect(
        resendBookingEmailFromDeliveryLog({
          booking: { ...buildBooking(), customer_email: null } as ReturnType<typeof buildBooking>,
          emailType: 'manage_link',
          templateType: 'manage_link',
          idempotencyKey: 'k',
        }),
      ).rejects.toMatchObject({ code: 'MISSING_RECIPIENT' });
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('queue sends with reportSkips', () => {
    it('rethrows a suppressed recipient instead of resolving as sent', async () => {
      sendEmail.mockRejectedValue(new SuppressedError('suppressed'));

      await expect(
        sendBookingConfirmationEmail(buildBooking(), { reportSkips: true }),
      ).rejects.toBeInstanceOf(SuppressedError);
    });

    it('reports a missing address as a skip', async () => {
      await expect(
        sendBookingConfirmationEmail(
          { ...buildBooking(), customer_email: null } as ReturnType<typeof buildBooking>,
          { reportSkips: true },
        ),
      ).rejects.toMatchObject({ name: 'BookingEmailSkippedError', reason: 'no_recipient' });
    });

    it('reports a recent duplicate reminder as a skip', async () => {
      hasRecentEmailDelivery.mockResolvedValue(true);

      const error = await sendBookingReminderEmail(buildBooking(), {
        variant: 'standard',
        reportSkips: true,
      }).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BookingEmailSkippedError);
      expect(error).toMatchObject({ reason: 'recent_duplicate' });
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });
});
