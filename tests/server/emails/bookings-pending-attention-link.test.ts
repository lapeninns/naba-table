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

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient,
}));

vi.mock('@/server/emails/email-delivery-log', () => ({
  hasRecentEmailDelivery,
  recordEmailDeliveryLog,
}));

import { sendBookingPendingAttentionEmail } from '@/server/emails/bookings';

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
    status: 'pending_allocation',
    reference: 'ABC123',
    booking_type: 'standard',
    seating_preference: 'any',
    notes: null,
    updated_at: '2026-05-11T12:00:00.000Z',
  } as Parameters<typeof sendBookingPendingAttentionEmail>[0];
}

function mockRestaurantLookup() {
  getServiceSupabaseClient.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'restaurant-1',
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

describe('sendBookingPendingAttentionEmail', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    getServiceSupabaseClient.mockReset();
    recordEmailDeliveryLog.mockReset();
    hasRecentEmailDelivery.mockReset();

    sendEmail.mockResolvedValue({ provider: 'mock', messageId: 'msg_booking' });
    recordEmailDeliveryLog.mockResolvedValue({ id: 'log-1' });
    hasRecentEmailDelivery.mockResolvedValue(false);
    mockRestaurantLookup();
  });

  it('links staff to the app-host bookings route with a focus parameter', async () => {
    await sendBookingPendingAttentionEmail(buildBooking(), {
      reason: 'Manual assignment needed',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@restaurant.test',
        html: expect.stringContaining('https://app.nabatable.com/bookings?focus=booking-1'),
        text: expect.stringContaining('https://app.nabatable.com/bookings?focus=booking-1'),
      }),
    );
    expect(sendEmail.mock.calls[0]?.[0].html).not.toContain('/dashboard/bookings/');
  });
});
