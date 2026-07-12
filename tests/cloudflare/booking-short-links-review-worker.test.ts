import { describe, expect, it, vi } from 'vitest';

import bookingShortLinkWorker from '@/cloudflare/booking-short-links/src/index';

type StoredRow = Record<string, unknown>;

function makeWorkerEnv() {
  const rows = new Map<string, StoredRow>();
  const prepare = vi.fn((query: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => {
        if (query.includes('WHERE token = ?')) return rows.get(String(args[0])) ?? null;
        if (!query.includes('WHERE booking_id = ?')) return null;
        return (
          [...rows.values()].find(
            (row) =>
              row.booking_id === args[0] &&
              row.purpose === args[1] &&
              row.created_by === args[2] &&
              row.destination_url === args[3] &&
              row.revoked_at === null &&
              String(row.expires_at) > String(args[4]),
          ) ?? null
        );
      },
      run: async () => {
        if (!query.includes('INSERT INTO booking_short_links')) return;
        rows.set(String(args[0]), {
          token: args[0],
          destination_url: args[1],
          destination_host: args[2],
          purpose: args[3],
          booking_id: args[4],
          restaurant_id: args[5],
          created_at: args[6],
          expires_at: args[7],
          revoked_at: args[8],
          last_accessed_at: args[9],
          created_by: args[10],
        });
      },
    }),
  }));
  return {
    env: {
      ALLOWED_DESTINATION_HOSTS: 'nabatable.com,www.nabatable.com,app.nabatable.com',
      BOOKING_SHORT_LINKS_DB: { prepare },
      BOOKING_SITE_URL: 'https://nabatable.com',
      INTERNAL_LINKS_TOKEN: 'internal-links-token',
      SHORT_LINKS_PUBLIC_BASE_URL: 'https://go.nabatable.com',
    },
    rows,
  };
}

function reviewRequest(destinationUrl = 'https://g.page/demo-venue/review', authorized = true) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authorized) headers.authorization = 'Bearer internal-links-token';
  return new Request('https://go.nabatable.test/internal/booking-links', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      purpose: 'review',
      destinationUrl,
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      expiresAt: '2099-01-01T00:00:00.000Z',
      createdBy: 'guest_review_whatsapp',
    }),
  });
}

describe('review short-link Worker HTTP surface', () => {
  it('creates and resolves an authenticated review link', async () => {
    const { env } = makeWorkerEnv();
    const createResponse = await bookingShortLinkWorker.fetch(reviewRequest(), env);
    const created = await createResponse.json();
    const shortUrl =
      typeof created === 'object' && created && 'shortUrl' in created
        ? String(created.shortUrl)
        : '';

    const resolveResponse = await bookingShortLinkWorker.fetch(new Request(shortUrl), env);

    expect(createResponse.status).toBe(201);
    expect(shortUrl).toMatch(/^https:\/\/go\.nabatable\.com\/r\/[0-9A-Za-z]{8,24}$/);
    expect(resolveResponse.status).toBe(302);
    expect(resolveResponse.headers.get('location')).toBe('https://g.page/demo-venue/review');
  });

  it('does not store a review link without internal authorization', async () => {
    const { env, rows } = makeWorkerEnv();

    const response = await bookingShortLinkWorker.fetch(reviewRequest(undefined, false), env);

    expect(response.status).toBe(401);
    expect(rows.size).toBe(0);
  });

  it('does not store an unsafe Google search URL', async () => {
    const { env, rows } = makeWorkerEnv();

    const response = await bookingShortLinkWorker.fetch(
      reviewRequest('https://search.google.com/search?q=demo'),
      env,
    );

    expect(response.status).toBe(400);
    expect(rows.size).toBe(0);
  });

  it('does not resolve a booking token through the review route', async () => {
    const { env, rows } = makeWorkerEnv();
    rows.set('Booking12345', {
      token: 'Booking12345',
      destination_url: 'https://nabatable.com/bookings/recover?token=abc',
      destination_host: 'nabatable.com',
      purpose: 'booking_manage',
      booking_id: 'booking-1',
      restaurant_id: 'rest-1',
      created_at: '2026-07-12T18:00:00.000Z',
      expires_at: '2099-01-01T00:00:00.000Z',
      revoked_at: null,
      last_accessed_at: null,
      created_by: 'guest_confirmation_sms',
    });

    const response = await bookingShortLinkWorker.fetch(
      new Request('https://go.nabatable.test/r/Booking12345'),
      env,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });

  it('rejects malformed review tokens before querying storage', async () => {
    const { env } = makeWorkerEnv();

    const response = await bookingShortLinkWorker.fetch(
      new Request('https://go.nabatable.test/r/not-a-valid-token!'),
      env,
    );

    expect(response.status).toBe(404);
    expect(env.BOOKING_SHORT_LINKS_DB.prepare).not.toHaveBeenCalled();
  });
});
