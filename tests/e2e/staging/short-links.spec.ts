import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { stagingEnv } from './env';

const staging = stagingEnv();

function expiresInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Mirrors CreateShortLinkRequest in cloudflare/booking-short-links/src/core.ts. */
function linkRequest(destinationUrl: string) {
  return {
    bookingId: randomUUID(),
    restaurantId: staging.tenantA.id,
    purpose: 'booking_manage',
    createdBy: 'guest_confirmation_sms',
    destinationUrl,
    expiresAt: expiresInDays(7),
  };
}

test.describe('booking short links persistence', () => {
  test('internal link creation requires the internal token @staging @worker @security', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_SHORT_LINKS_URL;
    test.skip(!origin, 'STAGING_SHORT_LINKS_URL not provided');
    const response = await request.post(`${origin}/internal/booking-links`, {
      data: linkRequest(`${staging.publicUrl}/bookings/${randomUUID()}`),
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(401);
  });

  test('a created link persists and resolves to the staging public host only @staging @worker @p0', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_SHORT_LINKS_URL;
    const token = staging.optional.STAGING_SHORT_LINKS_INTERNAL_TOKEN;
    test.skip(
      !origin || !token,
      'STAGING_SHORT_LINKS_URL / STAGING_SHORT_LINKS_INTERNAL_TOKEN not provided',
    );
    const destinationUrl = `${staging.publicUrl}/bookings/${randomUUID()}`;
    const created = await request.post(`${origin}/internal/booking-links`, {
      headers: { authorization: `Bearer ${token ?? ''}` },
      data: linkRequest(destinationUrl),
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const body = (await created.json()) as { shortUrl?: string };
    expect(body.shortUrl).toBeTruthy();
    expect(new URL(body.shortUrl ?? '').origin).toBe(origin);

    // Persistence: the same token resolves twice (D1 record, not a one-shot KV entry).
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const redirect = await request.get(body.shortUrl ?? '', {
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      expect([301, 302, 307, 308]).toContain(redirect.status());
      const location = redirect.headers().location ?? '';
      expect(new URL(location).origin).toBe(staging.publicUrl);
    }

    // Separation: the staging allowlist must not accept a production destination.
    const production = await request.post(`${origin}/internal/booking-links`, {
      headers: { authorization: `Bearer ${token ?? ''}` },
      data: linkRequest('https://nabatable.com/bookings/anything'),
      failOnStatusCode: false,
    });
    expect(production.status()).toBe(400);
  });
});
