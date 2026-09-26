/**
 * Booking capability links in outgoing mail (design §12 items 43-46): the
 * lost-link email, staff notifications and calendar files.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn());
const getServiceSupabaseClient = vi.hoisted(() => vi.fn());
const recordEmailDeliveryLog = vi.hoisted(() => vi.fn());
const hasRecentEmailDelivery = vi.hoisted(() => vi.fn());
const createBookingAccessTokenSpy = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

vi.mock('@/config', () => ({
  default: {
    appName: 'Nab a Table',
    auth: { loginUrl: '/auth' },
    email: {
      supportEmail: 'support@nabatable.com',
      platformReplyTo: 'platform@nabatable.com',
    },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    raw: { NEXT_PUBLIC_SITE_URL: 'https://www.nabatable.com' },
    app: { url: 'https://app.nabatable.com' },
    security: {
      sessionRecoveryAccessTokenSecret: 'test-session-recovery-secret',
    },
  },
}));

vi.mock('@/lib/site-url', () => ({
  getCanonicalSiteUrl: () => 'https://www.nabatable.com',
  getTrustedAppOrigin: () => 'https://app.nabatable.com',
  getTrustedSiteOrigin: () => 'https://www.nabatable.com',
}));

vi.mock('@/libs/resend', () => ({
  sendEmail,
  isEmailRecipientSuppressedError: (_error: unknown) => false,
  createEmailIdempotencyKey: ({ scope, parts }: { scope: string; parts: unknown[] }) =>
    `${scope}:${parts.join(':')}`,
}));

vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient }));

vi.mock('@/server/emails/email-delivery-log', () => ({
  hasRecentEmailDelivery,
  recordEmailDeliveryLog,
}));

const originalCreateToken = vi.hoisted(() => ({
  fn: null as null | ((...args: unknown[]) => unknown),
}));

vi.mock('@/server/security/booking-access-token', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  originalCreateToken.fn = actual.createBookingAccessToken as (...args: unknown[]) => unknown;
  return { ...actual, createBookingAccessToken: createBookingAccessTokenSpy };
});

import {
  sendBookingConfirmationEmail,
  sendBookingManageLinkEmail,
  sendBookingPendingAttentionEmail,
} from '@/server/emails/bookings';

const BOOKING_ID = '65c3207e-318a-4e4b-b82d-1249a720d776';
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function buildBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    restaurant_id: RESTAURANT_ID,
    customer_name: 'Guest One',
    customer_email: 'guest@example.com',
    customer_phone: '+447700900123',
    party_size: 2,
    booking_date: '2026-10-01',
    start_time: '18:00:00',
    end_time: '20:00:00',
    start_at: '2026-10-01T17:00:00.000Z',
    end_at: '2026-10-01T19:00:00.000Z',
    status: 'confirmed',
    reference: 'ABC123',
    booking_type: 'dinner',
    seating_preference: 'any',
    notes: null,
    updated_at: '2026-09-20T12:00:00.000Z',
    ...overrides,
  } as Parameters<typeof sendBookingManageLinkEmail>[0];
}

function mockRestaurantLookup() {
  getServiceSupabaseClient.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: RESTAURANT_ID,
              slug: 'the-venue',
              name: 'The Venue',
              timezone: 'Europe/London',
              address: '1 High Street',
              contact_phone: '+441234567890',
              contact_email: 'ops@restaurant.test',
              booking_policy: '',
              logo_url: null,
              google_map_url: null,
              google_review_url: null,
              email_templates: null,
            },
            error: null,
          }),
        })),
      })),
    })),
  });
}

function sentMessage() {
  const message = sendEmail.mock.calls[0]?.[0] as {
    to: string;
    subject: string;
    html: string;
    text: string;
    category: string;
    idempotencyKey: string;
    attachments: Array<{ filename: string; content: string; type: string }>;
  };
  return message;
}

describe('booking capability links in email', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({ provider: 'mock', messageId: 'msg_booking' });
    recordEmailDeliveryLog.mockReset();
    recordEmailDeliveryLog.mockResolvedValue({ id: 'log-1' });
    hasRecentEmailDelivery.mockReset();
    hasRecentEmailDelivery.mockResolvedValue(false);
    createBookingAccessTokenSpy.mockReset();
    createBookingAccessTokenSpy.mockImplementation((...args: unknown[]) =>
      originalCreateToken.fn?.(...args),
    );
    mockRestaurantLookup();
  });

  it('§43 the lost-link email carries a fresh link for that booking only, with no .ics', async () => {
    await sendBookingManageLinkEmail(buildBooking(), { nonce: 'manage_link:abc:1' });

    const message = sentMessage();
    expect(message.to).toBe('guest@example.com');
    expect(message.subject).toBe('Your booking link for The Venue');
    expect(message.category).toBe('booking_update');
    expect(message.html).toContain('/bookings/recover?access_token=bk1.');
    expect(message.text).toContain('/bookings/recover?access_token=bk1.');
    expect(message.html).toContain('Manage your booking');
    expect(message.attachments).toEqual([]);
    expect(message.idempotencyKey).toContain(BOOKING_ID);

    await sendBookingManageLinkEmail(buildBooking(), { nonce: 'manage_link:abc:2' });
    const second = sendEmail.mock.calls[1]?.[0] as { idempotencyKey: string };
    expect(second.idempotencyKey).not.toBe(message.idempotencyKey);

    const tokenArgs = createBookingAccessTokenSpy.mock.calls.map(
      (call) => call[0] as { booking: { id: string }; source: string },
    );
    expect(
      tokenArgs.every((args) => args.booking.id === BOOKING_ID && args.source === 'link'),
    ).toBe(true);
  });

  it('§44 the pending_attention staff email never carries an access token', async () => {
    await sendBookingPendingAttentionEmail(buildBooking({ status: 'pending_allocation' }), {
      reason: 'Manual assignment needed',
    });

    const message = sentMessage();
    expect(message.to).toBe('ops@restaurant.test');
    expect(message.html).not.toContain('access_token=');
    expect(message.text).not.toContain('access_token=');
    expect(message.html).toContain(`https://www.nabatable.com/bookings/${BOOKING_ID}`);
    expect(createBookingAccessTokenSpy).not.toHaveBeenCalled();
  });

  it('§45 the confirmation .ics links the plain booking page, and §46 mints one token', async () => {
    await sendBookingConfirmationEmail(buildBooking());

    const message = sentMessage();
    const ics = message.attachments.find((attachment) => attachment.type === 'text/calendar');
    expect(ics).toBeDefined();
    const unfolded = String(ics?.content).replace(/\r?\n[ \t]/g, '');
    expect(unfolded).toContain(`/bookings/${BOOKING_ID}`);
    expect(unfolded).not.toContain('access_token=');
    expect(message.html).toContain('/bookings/recover?access_token=bk1.');
    expect(createBookingAccessTokenSpy).toHaveBeenCalledTimes(1);
  });
});
