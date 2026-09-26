import { randomUUID } from 'node:crypto';

import { futureBookingDate, stagingEnv } from './env';
import { withStagingProtection } from './protection';
import { expect, test } from './test';

import type { APIRequestContext } from '@playwright/test';

const staging = stagingEnv();

type BookingResponse = {
  booking?: { id?: string; status?: string; restaurant_id?: string };
  duplicate?: boolean;
};

/** Mirrors `bookingCreateRequestSchema` (server/bookings/request-validation.ts). */
function bookingPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    restaurantId: staging.tenantA.id,
    restaurantSlug: staging.tenantA.slug,
    date: futureBookingDate(),
    time: '12:30',
    party: 2,
    bookingType: 'lunch',
    name: 'Synthetic Guest',
    email: staging.guest.email,
    phone: staging.guest.phone,
    notes: 'staging-proof',
    marketingOptIn: false,
    whatsappOptIn: false,
    ...overrides,
  };
}

async function availableBookingPayload(request: APIRequestContext) {
  // Query the shipped capacity contract, avoiding the dates used by older runs.
  // A positive read does not reserve capacity: creation must still return 201.
  for (let daysAhead = 4; daysAhead <= 10; daysAhead += 1) {
    const date = futureBookingDate(daysAhead);
    const time = '12:30';
    const availability = await test.step(`Check availability ${daysAhead} days ahead`, () =>
      request.get(`${staging.publicUrl}/api/availability`, {
        params: { restaurantId: staging.tenantA.id, date, time, partySize: '2' },
        headers: { 'Cache-Control': 'no-cache' },
        maxRedirects: 0,
        timeout: 15_000,
      }));
    expect(availability.status()).toBe(200);
    const slot = (await availability.json()) as {
      restaurantId?: string;
      date?: string;
      time?: string;
      partySize?: number;
      available?: boolean;
    };
    expect(slot).toMatchObject({ restaurantId: staging.tenantA.id, date, time, partySize: 2 });
    expect(typeof slot.available).toBe('boolean');
    if (slot.available) return bookingPayload({ date, time });
  }
  throw new Error('No available synthetic lunch slot within the bounded proof window');
}

/**
 * Guest writes need the double-submit CSRF pair. The proxy issues `sr-csrf-token` on the
 * first response, which the request context stores; echo it back as the header.
 */
async function csrfHeaders(context: APIRequestContext): Promise<Record<string, string>> {
  const state = await context.storageState();
  const token = state.cookies.find((cookie) => cookie.name === 'sr-csrf-token')?.value;
  if (!token) throw new Error('Staging proxy did not issue the CSRF cookie');
  return { 'x-csrf-token': token };
}

async function createBooking(
  request: APIRequestContext,
  idempotencyKey: string,
  payload: ReturnType<typeof bookingPayload>,
) {
  return request.post(`${staging.publicUrl}/api/bookings`, {
    headers: { 'Idempotency-Key': idempotencyKey, 'content-type': 'application/json' },
    data: payload,
    timeout: 15_000,
    failOnStatusCode: false,
  });
}

test.describe('guest booking lifecycle on synthetic tenant', () => {
  test('creates a booking and answers an idempotent replay exactly like the original @staging @p0', async ({
    request,
  }) => {
    const payload = await availableBookingPayload(request);
    const key = randomUUID();
    let bookingId: string | undefined;
    try {
      const first = await test.step('Create synthetic booking', () =>
        createBooking(request, key, payload));
      expect(first.status()).toBe(201);
      const created = (await first.json()) as BookingResponse;
      bookingId = created.booking?.id;
      expect(bookingId).toBeTruthy();
      expect(created.booking?.restaurant_id).toBe(staging.tenantA.id);
      expect(created.duplicate).toBe(false);

      // Reuse the exact object, including the selected date, for the replay. A fresh replay
      // of the creator's own key answers like the insert (201, same body) and re-issues the
      // booking cookie; it writes no second booking.
      const replay = await test.step('Replay identical booking request', () =>
        createBooking(request, key, payload));
      expect(replay.status()).toBe(201);
      const replayed = (await replay.json()) as BookingResponse;
      expect(replayed.duplicate).toBe(false);
      expect(replayed.booking?.id).toBe(bookingId);
    } finally {
      if (bookingId) {
        // Creation issued this request context the booking-scoped creator cookie
        // (__Host-nt_bk.<id>). Cancel only the fixture created above and verify it.
        const headers = await csrfHeaders(request);
        const cancelled = await test.step('Cancel created fixture using the creator cookie', () =>
          request.delete(`${staging.publicUrl}/api/bookings/${bookingId}`, {
            headers,
            timeout: 15_000,
          }));
        expect(cancelled.status()).toBe(200);
        expect(await cancelled.json()).toMatchObject({ id: bookingId, status: 'cancelled' });
        const readback =
          await test.step('Verify fixture cancellation through the creator cookie', () =>
            request.get(`${staging.publicUrl}/api/bookings/${bookingId}`, { timeout: 15_000 }));
        expect(readback.status()).toBe(200);
        expect(await readback.json()).toMatchObject({
          booking: { id: bookingId, restaurant_id: staging.tenantA.id, status: 'cancelled' },
        });
      }
    }
  });

  test('rejects malformed JSON and unknown tenants with safe errors @staging @p0', async ({
    request,
  }) => {
    const malformed = await request.post(`${staging.publicUrl}/api/bookings`, {
      headers: { 'content-type': 'application/json' },
      data: '{not json',
      failOnStatusCode: false,
    });
    expect(malformed.status()).toBe(400);

    const unknownTenant = await request.post(`${staging.publicUrl}/api/bookings`, {
      headers: { 'Idempotency-Key': randomUUID(), 'content-type': 'application/json' },
      data: bookingPayload({ restaurantId: randomUUID(), restaurantSlug: 'does-not-exist' }),
      failOnStatusCode: false,
    });
    expect([400, 404, 422]).toContain(unknownTenant.status());
    const text = await unknownTenant.text();
    expect(text).not.toContain(staging.guest.email);
    expect(text).not.toContain(staging.guest.phone);
  });

  test('creator cookies enforce tenant isolation and cancellation stays terminal @staging @p0 @security', async ({
    playwright,
  }) => {
    // Separate cookie jars are essential: create issues a booking-scoped creator cookie
    // (__Host-nt_bk.<id>) to the context that made the booking.
    const contexts = await Promise.all(
      [staging.tenantA, staging.tenantB].map(async () =>
        withStagingProtection(
          await playwright.request.newContext({ baseURL: staging.publicUrl }),
          staging.publicUrl,
          staging.opsUrl,
          process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        ),
      ),
    );
    const bookings: Array<{ id: string; context: APIRequestContext }> = [];
    try {
      for (const [index, tenant] of [staging.tenantA, staging.tenantB].entries()) {
        const context = contexts[index]!;
        const response = await context.post('/api/bookings', {
          headers: { 'Idempotency-Key': randomUUID() },
          data: bookingPayload({
            restaurantId: tenant.id,
            restaurantSlug: tenant.slug,
            date: futureBookingDate(3),
          }),
        });
        expect(response.status()).toBe(201);
        const created = (await response.json()) as BookingResponse;
        expect(created.booking?.id).toBeTruthy();
        expect(created.booking?.restaurant_id).toBe(tenant.id);
        const id = created.booking!.id!;
        bookings.push({ id, context });
        const own = await context.get(`/api/bookings/${id}`);
        expect(own.status()).toBe(200);
        expect(((await own.json()) as BookingResponse).booking?.id).toBe(id);
      }
      for (const [index, booking] of bookings.entries()) {
        const other = contexts[1 - index]!;
        for (const method of ['get', 'delete'] as const) {
          const denied = await other[method](`/api/bookings/${booking.id}`, {
            headers: {
              'x-restaurant-id': [staging.tenantA, staging.tenantB][index]!.id,
              ...(await csrfHeaders(other)),
            },
          });
          expect(denied.status()).toBe(404);
          expect(await denied.json()).toMatchObject({ code: 'BOOKING_NOT_FOUND' });
        }
        const ownHeaders = await csrfHeaders(booking.context);
        const cancelled = await booking.context.delete(`/api/bookings/${booking.id}`, {
          headers: ownHeaders,
        });
        expect(cancelled.status()).toBe(200);
        expect(await cancelled.json()).toMatchObject({ id: booking.id, status: 'cancelled' });
        const replay = await booking.context.delete(`/api/bookings/${booking.id}`, {
          headers: ownHeaders,
        });
        expect(replay.status()).toBe(200);
        expect(await replay.json()).toMatchObject({ id: booking.id, status: 'cancelled' });
        const update = await booking.context.put(`/api/bookings/${booking.id}`, {
          headers: ownHeaders,
          data: bookingPayload({ restaurantId: [staging.tenantA, staging.tenantB][index]!.id }),
        });
        expect(update.status()).toBe(409);
        expect(await update.json()).toMatchObject({ code: 'BOOKING_CANCELLED' });
        const readback = await booking.context.get(`/api/bookings/${booking.id}`);
        expect(readback.status()).toBe(200);
        expect(((await readback.json()) as BookingResponse).booking?.status).toBe('cancelled');
      }
    } finally {
      // Best-effort cancellation retains audit history, including if an assertion failed.
      for (const booking of bookings) {
        await csrfHeaders(booking.context)
          .then((headers) => booking.context.delete(`/api/bookings/${booking.id}`, { headers }))
          .catch(() => undefined);
      }
      await Promise.all(contexts.map((context) => context.dispose()));
    }
  });

  test.fixme('holds under capacity contention resolve to exactly one confirmed booking @staging @p0', async () => {
    // Requires the staging hold fixture endpoint (STAGING_SYNTHETIC_* hold seat + capacity
    // reset) so two concurrent creates can contend for one slot. Interface not shipped yet.
  });
});
