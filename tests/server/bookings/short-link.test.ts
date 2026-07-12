import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildBookingManageUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/bookings/manage-url', () => ({
  buildBookingManageUrl: buildBookingManageUrlMock,
}));

vi.mock('@/lib/env', () => ({
  env: {
    cloudflare: {
      bookingShortLinksBaseUrl: 'https://go.nabatable.com',
      bookingShortLinksInternalUrl: 'https://nabatable-booking-short-links.workers.dev',
      bookingShortLinksInternalToken: 'secret-token',
    },
    security: {
      sessionRecoveryAccessTokenTtlSeconds: 900,
    },
  },
}));

import { createBookingManageShortUrl, createReviewShortUrl } from '@/server/bookings/short-link';

const booking = {
  id: 'booking-1',
  restaurant_id: 'rest-1',
  customer_email: 'guest@example.com',
  customer_phone: '+447700900000',
} as const;

describe('createBookingManageShortUrl', () => {
  beforeEach(() => {
    buildBookingManageUrlMock.mockReset();
    buildBookingManageUrlMock.mockReturnValue('https://nabatable.com/bookings/recover?token=abc');
  });

  it('returns the long URL when the short-link service rejects the request', async () => {
    const shortUrl = await createBookingManageShortUrl(booking as never, {
      createdBy: 'guest_confirmation_sms',
      fetchImpl: vi.fn().mockResolvedValue(new Response('nope', { status: 500 })),
    });

    expect(shortUrl).toBe('https://nabatable.com/bookings/recover?token=abc');
  });

  it('returns the long URL when the manage URL is already an error route', async () => {
    buildBookingManageUrlMock.mockReturnValue(
      'https://nabatable.com/bookings/recover/error?code=INVALID_ACCESS_TOKEN',
    );

    const shortUrl = await createBookingManageShortUrl(booking as never, {
      createdBy: 'guest_confirmation_sms',
      fetchImpl: vi.fn(),
    });

    expect(shortUrl).toBe('https://nabatable.com/bookings/recover/error?code=INVALID_ACCESS_TOKEN');
  });

  it('returns a Cloudflare short URL when the internal service succeeds', async () => {
    const shortUrl = await createBookingManageShortUrl(booking as never, {
      createdBy: 'guest_update_sms',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            token: 'ABC123',
            shortUrl: 'https://go.nabatable.com/m/ABC123',
            expiresAt: '2026-05-01T00:00:00.000Z',
          }),
          { status: 201 },
        ),
      ),
    });

    expect(shortUrl).toBe('https://go.nabatable.com/m/ABC123');
  });
});

describe('createReviewShortUrl', () => {
  it('requests a purpose-scoped review URL with a normalized Google destination', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: 'Review123456',
          shortUrl: 'https://go.nabatable.com/r/Review123456',
          expiresAt: '2099-01-01T00:00:00.000Z',
        }),
        { status: 201 },
      ),
    );

    const shortUrl = await createReviewShortUrl({
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      destinationUrl: ' HTTPS://G.PAGE/demo-venue/review ',
      expiresAt: '2099-01-01T00:00:00.000Z',
      fetchImpl,
    });

    expect(shortUrl).toBe('https://go.nabatable.com/r/Review123456');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://nabatable-booking-short-links.workers.dev/internal/booking-links',
      expect.objectContaining({
        body: JSON.stringify({
          purpose: 'review',
          destinationUrl: 'https://g.page/demo-venue/review',
          bookingId: 'booking-1',
          restaurantId: 'rest-1',
          expiresAt: '2099-01-01T00:00:00.000Z',
          createdBy: 'guest_review_whatsapp',
        }),
      }),
    );
  });

  it('refuses unsafe review destinations before calling the Worker', async () => {
    const fetchImpl = vi.fn();

    const shortUrl = await createReviewShortUrl({
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      destinationUrl: 'https://search.google.com/search?q=demo',
      expiresAt: '2099-01-01T00:00:00.000Z',
      fetchImpl,
    });

    expect(shortUrl).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a booking-purpose URL returned for a review request', async () => {
    const shortUrl = await createReviewShortUrl({
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      destinationUrl: 'https://g.page/demo-venue/review',
      expiresAt: '2099-01-01T00:00:00.000Z',
      fetchImpl: vi
        .fn()
        .mockResolvedValue(Response.json({ shortUrl: 'https://go.nabatable.com/m/Booking12345' })),
    });

    expect(shortUrl).toBeNull();
  });
});
