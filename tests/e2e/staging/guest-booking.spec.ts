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

async function createBooking(request: APIRequestContext, idempotencyKey: string) {
  return request.post(`${staging.publicUrl}/api/bookings`, {
    headers: { 'Idempotency-Key': idempotencyKey, 'content-type': 'application/json' },
    data: bookingPayload(),
    failOnStatusCode: false,
  });
}

test.describe('guest booking lifecycle on synthetic tenant', () => {
  test('creates a booking and treats an idempotent replay as a duplicate @staging @p0', async ({
    request,
  }) => {
    const key = randomUUID();
    const first = await createBooking(request, key);
    expect(first.status(), await first.text()).toBe(201);
    const created = (await first.json()) as BookingResponse;
    expect(created.duplicate).toBe(false);
    expect(created.booking?.id).toBeTruthy();

    // Same Idempotency-Key + same payload: the API returns the existing booking with 200.
    const replay = await createBooking(request, key);
    expect(replay.status(), await replay.text()).toBe(200);
    const duplicate = (await replay.json()) as BookingResponse;
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.booking?.id).toBe(created.booking?.id);
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

  test('recovery sessions enforce tenant isolation and cancellation stays terminal @staging @p0 @security', async ({
    playwright,
  }) => {
    // Separate cookie jars are essential: create issues a tenant/contact-bound sr_access cookie.
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
            headers: { 'x-restaurant-id': [staging.tenantA, staging.tenantB][index]!.id },
          });
          expect(denied.status()).toBe(404);
          expect(await denied.json()).toMatchObject({ code: 'BOOKING_NOT_FOUND' });
        }
        const cancelled = await booking.context.delete(`/api/bookings/${booking.id}`);
        expect(cancelled.status()).toBe(200);
        expect(await cancelled.json()).toMatchObject({ id: booking.id, status: 'cancelled' });
        const replay = await booking.context.delete(`/api/bookings/${booking.id}`);
        expect(replay.status()).toBe(200);
        expect(await replay.json()).toMatchObject({ id: booking.id, status: 'cancelled' });
        const update = await booking.context.put(`/api/bookings/${booking.id}`, {
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
        await booking.context.delete(`/api/bookings/${booking.id}`).catch(() => undefined);
      }
      await Promise.all(contexts.map((context) => context.dispose()));
    }
  });

  test.fixme('holds under capacity contention resolve to exactly one confirmed booking @staging @p0', async () => {
    // Requires the staging hold fixture endpoint (STAGING_SYNTHETIC_* hold seat + capacity
    // reset) so two concurrent creates can contend for one slot. Interface not shipped yet.
  });

  test.fixme('assignment, cancellation and terminal transitions are monotonic @staging @p0', async () => {
    // Requires an ops session for the synthetic tenant (STAGING_SYNTHETIC_OPS_EMAIL /
    // magic-link relay) to drive assign -> seat -> complete and assert that no transition
    // out of a terminal state is accepted. Ops auth relay for staging is not provisioned.
  });
});
