import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildBookingManageUrlMock = vi.hoisted(() => vi.fn());
const buildBookingManageLinkMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/bookings/manage-url', () => ({
  buildBookingManageLink: buildBookingManageLinkMock,
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

const LINK = {
  url: 'https://nabatable.com/bookings/recover?access_token=bk1.a.b.c',
  expiresAt: new Date('2026-06-02T19:30:00.000Z'),
};

describe('createBookingManageShortUrl', () => {
  beforeEach(() => {
    buildBookingManageUrlMock.mockReset();
    buildBookingManageLinkMock.mockReset();
    buildBookingManageLinkMock.mockReturnValue(LINK);
  });

  it('returns the long URL when the short-link service rejects the request', async () => {
    const shortUrl = await createBookingManageShortUrl(booking as never, {
      createdBy: 'guest_confirmation_sms',
      fetchImpl: vi.fn().mockResolvedValue(new Response('nope', { status: 500 })),
    });

    expect(shortUrl).toBe(LINK.url);
  });

  it('returns the unshortened error URL when no link can be minted', async () => {
    buildBookingManageLinkMock.mockReturnValue(null);
    buildBookingManageUrlMock.mockReturnValue(
      'https://nabatable.com/bookings/recover/error?code=MISSING_ACCESS_TOKEN',
    );
    const fetchImpl = vi.fn();

    const shortUrl = await createBookingManageShortUrl(booking as never, {
      createdBy: 'guest_confirmation_sms',
      fetchImpl,
    });

    expect(shortUrl).toBe('https://nabatable.com/bookings/recover/error?code=MISSING_ACCESS_TOKEN');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('expires the short link with the link token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: 'ABC123',
          shortUrl: 'https://go.nabatable.com/m/ABC123',
          expiresAt: LINK.expiresAt.toISOString(),
        }),
        { status: 201 },
      ),
    );
    const shortUrl = await createBookingManageShortUrl(booking as never, {
      createdBy: 'guest_update_sms',
      fetchImpl,
    });

    expect(shortUrl).toBe('https://go.nabatable.com/m/ABC123');
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      purpose: 'booking_manage',
      destinationUrl: LINK.url,
      expiresAt: '2026-06-02T19:30:00.000Z',
    });
  });
});

describe('createReviewShortUrl', () => {
  it('requests a purpose-scoped review URL with a normalized Google destination @contract', async () => {
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

  it('refuses unsafe review destinations before calling the Worker @contract', async () => {
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

  it('refuses a booking-purpose URL returned for a review request @contract', async () => {
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
