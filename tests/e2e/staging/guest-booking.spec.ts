import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { futureBookingDate, stagingEnv } from './env';

const staging = stagingEnv();

type BookingResponse = {
  booking?: { id?: string; status?: string };
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
