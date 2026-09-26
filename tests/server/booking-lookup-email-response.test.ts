/**
 * POST /api/bookings/lookup-email (design §7 and §12 items 37-42).
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    node: { env: 'test' },
    security: {
      sessionRecoveryAccessTokenSecret: 'test-session-recovery-secret',
      turnstileSecretKey: null,
    },
  },
}));

// Real collaborators are injected through LookupEmailDeps; stub their modules.
vi.mock('@/server/bookings', () => ({ fetchBookingsForContact: vi.fn() }));
vi.mock('@/server/queue/email', () => ({ enqueueEmailJob: vi.fn() }));
vi.mock('@/server/observability', () => ({ recordObservabilityEvent: vi.fn() }));
vi.mock('@/server/security/turnstile', () => ({ verifyTurnstileToken: vi.fn() }));
vi.mock('@/server/bookings/restaurant-resolution', () => ({ resolveBookingRestaurantId: vi.fn() }));
vi.mock('@/server/security/rate-limit', () => ({ consumeRateLimit: vi.fn() }));

vi.mock('@/server/supabase', () => ({
  getTenantServiceSupabaseClient: vi.fn(),
  getServiceSupabaseClient: vi.fn(),
}));

import { consumeContactThrottle, lookupContactKey } from '@/server/bookings/lookup-contact-key';
import {
  buildLookupEmailHttpResponse,
  selectManageLinkBookings,
  type LookupEmailDeps,
} from '@/server/bookings/lookup-email-response';
import { isManageLinkEligibleBooking } from '@/server/bookings/manage-link-eligibility';

import { guestRequestHeaders } from './helpers/guestBookingAccess';

import type { BookingRecord } from '@/server/bookings';

const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-09-26T12:00:00.000Z');

function booking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: '65c3207e-318a-4e4b-b82d-1249a720d776',
    restaurant_id: R1,
    customer_email: 'guest@example.com',
    customer_phone: '+447700900123',
    status: 'confirmed',
    booking_date: '2026-10-01',
    start_at: '2026-10-01T18:00:00.000Z',
    end_at: '2026-10-01T19:30:00.000Z',
    ...overrides,
  } as BookingRecord;
}

function makeRequest(body: unknown, options: { csrf?: boolean; ip?: string } = {}) {
  return new NextRequest('https://www.nabatable.com/api/bookings/lookup-email', {
    method: 'POST',
    headers: {
      ...guestRequestHeaders({ csrf: options.csrf }),
      'content-type': 'application/json',
      'x-forwarded-for': options.ip ?? '203.0.113.7',
    },
    body: JSON.stringify(body),
  });
}

function createDeps(overrides: Partial<LookupEmailDeps> = {}) {
  const buckets = new Map<string, number>();
  const tasks: Array<() => Promise<void>> = [];
  const consume = vi.fn(async ({ identifier, limit }: { identifier: string; limit: number }) => {
    const count = (buckets.get(identifier) ?? 0) + 1;
    buckets.set(identifier, count);
    return {
      ok: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + 60_000,
      source: 'memory' as const,
    };
  });
  const deps: LookupEmailDeps = {
    now: () => NOW,
    secret: 'test-session-recovery-secret',
    turnstileEnabled: false,
    consumeRateLimit: consume,
    consumeContactThrottle: (key) => consumeContactThrottle(key, { consume }),
    verifyTurnstile: vi.fn(async () => ({
      ok: true as const,
      action: null,
      hostname: null,
      errorCodes: [],
    })),
    resolveRestaurantId: vi.fn(async ({ restaurantId, restaurantSlug }) =>
      restaurantSlug === 'the-bell'
        ? { ok: true as const, restaurantId: R2, source: 'slug' as const }
        : restaurantId
          ? { ok: true as const, restaurantId, source: 'payload' as const }
          : { ok: false as const, status: 404, code: 'RESTAURANT_NOT_FOUND', error: 'x' },
    ),
    fetchBookings: vi.fn(async () => []),
    enqueueEmail: vi.fn(async () => undefined),
    recordEvent: vi.fn(async () => undefined),
    runAfter: (task) => {
      tasks.push(task);
    },
    ...overrides,
  };
  return {
    deps,
    buckets,
    runAfterTasks: async () => {
      for (const task of tasks.splice(0)) await task();
    },
    afterCount: () => tasks.length,
  };
}

async function withTrustedForwardedIp<T>(callback: () => Promise<T>): Promise<T> {
  const previous = process.env.TRUST_FORWARDED_IP_HEADERS;
  process.env.TRUST_FORWARDED_IP_HEADERS = 'true';
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.TRUST_FORWARDED_IP_HEADERS;
    else process.env.TRUST_FORWARDED_IP_HEADERS = previous;
  }
}

async function snapshot(response: Response) {
  return {
    status: response.status,
    body: await response.text(),
    headers: [...response.headers.entries()].filter(([name]) => name !== 'date'),
  };
}

describe('lookup-email response', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('§37 answers identically for matching, non-matching and past-or-cancelled contacts', async () => {
    const scenarios: BookingRecord[][] = [
      [booking()],
      [],
      [booking({ status: 'cancelled' }), booking({ end_at: '2026-09-01T20:00:00.000Z' })],
    ];
    const results = [];
    for (const rows of scenarios) {
      const harness = createDeps({ fetchBookings: vi.fn(async () => rows) });
      const response = await buildLookupEmailHttpResponse(
        makeRequest({ restaurantId: R1, email: 'guest@example.com' }),
        harness.deps,
      );
      results.push(await snapshot(response));
      expect(harness.afterCount()).toBe(1);
    }
    expect(results[0].status).toBe(202);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(results[0].headers).toContainEqual(['cache-control', 'no-store']);
  });

  it('§38 enqueues only booking ids; the recipient is never the request input', async () => {
    const harness = createDeps({ fetchBookings: vi.fn(async () => [booking()]) });
    await buildLookupEmailHttpResponse(
      makeRequest({ restaurantId: R1, email: 'Guest@Example.com' }),
      harness.deps,
    );
    await harness.runAfterTasks();

    expect(harness.deps.enqueueEmail).toHaveBeenCalledTimes(1);
    const [payload] = vi.mocked(harness.deps.enqueueEmail).mock.calls[0];
    expect(payload).toEqual({
      bookingId: '65c3207e-318a-4e4b-b82d-1249a720d776',
      restaurantId: R1,
      type: 'manage_link',
    });
  });

  it('§38 skips bookings whose stored email differs from the requested one', () => {
    expect(
      selectManageLinkBookings(
        [booking({ customer_email: 'other@example.com' })],
        'guest@example.com',
        NOW,
      ),
    ).toEqual([]);
  });

  it('§39 limits per IP (429 on the 6th in 15 minutes)', async () => {
    const harness = createDeps();
    const statuses: number[] = [];
    await withTrustedForwardedIp(async () => {
      for (let index = 0; index < 6; index += 1) {
        const response = await buildLookupEmailHttpResponse(
          makeRequest({ restaurantId: R1, email: `guest${index}@example.com` }),
          harness.deps,
        );
        statuses.push(response.status);
      }
    });
    expect(statuses.slice(0, 5)).toEqual([202, 202, 202, 202, 202]);
    expect(statuses[5]).toBe(429);
    expect([...harness.buckets.keys()]).toContain('bookings:lookup-email:ip:v4:203.0.113.7');
  });

  it('§39 keys the IP limit per address, not per /16', async () => {
    const harness = createDeps();
    const statuses: number[] = [];
    await withTrustedForwardedIp(async () => {
      for (let index = 0; index < 6; index += 1) {
        const response = await buildLookupEmailHttpResponse(
          makeRequest(
            { restaurantId: R1, email: `guest${index}@example.com` },
            { ip: `203.0.${index}.7` },
          ),
          harness.deps,
        );
        statuses.push(response.status);
      }
    });
    expect(statuses).toEqual([202, 202, 202, 202, 202, 202]);
  });

  it('§39 never pools clients with no usable IP into one shared bucket', async () => {
    const harness = createDeps();
    const statuses: number[] = [];
    for (let index = 0; index < 8; index += 1) {
      const response = await buildLookupEmailHttpResponse(
        makeRequest({ restaurantId: R1, email: `guest${index}@example.com` }),
        harness.deps,
      );
      statuses.push(response.status);
    }
    expect(statuses.every((status) => status === 202)).toBe(true);
    expect([...harness.buckets.keys()].some((key) => key.includes(':ip:'))).toBe(false);
  });

  it('answers 503 BOOKING_LINKS_UNAVAILABLE, not a false 202, when links cannot be minted', async () => {
    const harness = createDeps({ secret: null });
    const response = await buildLookupEmailHttpResponse(
      makeRequest({ restaurantId: R1, email: 'guest@example.com' }),
      harness.deps,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'BOOKING_LINKS_UNAVAILABLE' });
    expect(harness.afterCount()).toBe(0);
  });

  it('§39 throttles per contact: the 4th in an hour and the 6th in a day are silent 202s', async () => {
    const harness = createDeps({ fetchBookings: vi.fn(async () => [booking()]) });
    const statuses: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const response = await buildLookupEmailHttpResponse(
        makeRequest(
          { restaurantId: R1, email: 'guest@example.com' },
          { ip: `198.51.100.${index}` },
        ),
        harness.deps,
      );
      statuses.push(response.status);
      await harness.runAfterTasks();
    }
    expect(statuses).toEqual([202, 202, 202, 202]);
    expect(harness.deps.enqueueEmail).toHaveBeenCalledTimes(3);

    // Daily budget: exhaust with a fresh hourly window for the same contact key.
    const key = lookupContactKey({
      restaurantId: R1,
      email: 'guest@example.com',
      secret: 'test-session-recovery-secret',
    });
    expect([...harness.buckets.keys()].join('\n')).not.toContain('guest@example.com');
    harness.buckets.set(`bookings:lookup-email:contact-h:${key}`, 0);
    harness.buckets.set(`bookings:lookup-email:contact-d:${key}`, 5);
    vi.mocked(harness.deps.enqueueEmail).mockClear();
    const sixth = await buildLookupEmailHttpResponse(
      makeRequest({ restaurantId: R1, email: 'guest@example.com' }, { ip: '198.51.100.99' }),
      harness.deps,
    );
    await harness.runAfterTasks();
    expect(sixth.status).toBe(202);
    expect(harness.deps.enqueueEmail).not.toHaveBeenCalled();
  });

  it('§39 reuses the job id within one 15-minute bucket', async () => {
    const harness = createDeps({ fetchBookings: vi.fn(async () => [booking()]) });
    for (let index = 0; index < 2; index += 1) {
      await buildLookupEmailHttpResponse(
        makeRequest({ restaurantId: R1, email: 'guest@example.com' }, { ip: `192.0.2.${index}` }),
        harness.deps,
      );
      await harness.runAfterTasks();
    }
    const jobIds = vi
      .mocked(harness.deps.enqueueEmail)
      .mock.calls.map((call) => (call[1] as { jobId: string }).jobId);
    expect(jobIds).toHaveLength(2);
    expect(jobIds[0]).toBe(jobIds[1]);
    expect(jobIds[0]).toMatch(/^manage_link:65c3207e-318a-4e4b-b82d-1249a720d776:\d+$/);
  });

  it('§40 enqueues at most 5, soonest first', async () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      booking({
        id: `${index}5c3207e-318a-4e4b-b82d-1249a720d776`,
        start_at: `2026-10-0${7 - index}T18:00:00.000Z`,
        end_at: `2026-10-0${7 - index}T19:30:00.000Z`,
      }),
    );
    const harness = createDeps({ fetchBookings: vi.fn(async () => rows) });
    await buildLookupEmailHttpResponse(
      makeRequest({ restaurantId: R1, email: 'guest@example.com' }),
      harness.deps,
    );
    await harness.runAfterTasks();
    const ids = vi
      .mocked(harness.deps.enqueueEmail)
      .mock.calls.map((call) => (call[0] as { bookingId: string }).bookingId);
    expect(ids).toHaveLength(5);
    expect(ids[0]).toBe('65c3207e-318a-4e4b-b82d-1249a720d776');
    const event = vi.mocked(harness.deps.recordEvent).mock.calls[0][0];
    expect(event).toMatchObject({
      eventType: 'booking_lookup_email.requested',
      context: { restaurantId: R1, matched: true, count: 5 },
    });
    expect(JSON.stringify(event)).not.toContain('@');
  });

  it('§40 window alignment: a booking in progress is sent, an ended one is not', () => {
    const inProgress = booking({
      start_at: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
      end_at: new Date(NOW.getTime() + 60 * 60_000).toISOString(),
    });
    const ended = booking({
      start_at: new Date(NOW.getTime() - 3 * 3600_000).toISOString(),
      end_at: new Date(NOW.getTime() - 60_000).toISOString(),
    });
    expect(selectManageLinkBookings([inProgress], 'guest@example.com', NOW)).toHaveLength(1);
    expect(isManageLinkEligibleBooking(inProgress, NOW)).toBe(true);
    expect(selectManageLinkBookings([ended], 'guest@example.com', NOW)).toHaveLength(0);
    expect(isManageLinkEligibleBooking(ended, NOW)).toBe(false);
  });

  it('§41 resolves the slug to its own tenant and looks up only that tenant', async () => {
    const harness = createDeps();
    await buildLookupEmailHttpResponse(
      makeRequest({ restaurantSlug: 'the-bell', email: 'guest@example.com' }),
      harness.deps,
    );
    await harness.runAfterTasks();
    expect(harness.deps.fetchBookings).toHaveBeenCalledWith(R2, 'guest@example.com');
  });

  it('§42 requires the CSRF token, a valid body and (when configured) Turnstile', async () => {
    const harness = createDeps({
      turnstileEnabled: true,
      verifyTurnstile: vi.fn(async () => ({
        ok: false as const,
        reason: 'verification_failed' as const,
        action: null,
        hostname: null,
        errorCodes: [],
      })),
    });

    const noCsrf = await buildLookupEmailHttpResponse(
      makeRequest({ restaurantId: R1, email: 'guest@example.com' }, { csrf: false }),
      harness.deps,
    );
    expect(noCsrf.status).toBe(403);

    const both = await buildLookupEmailHttpResponse(
      makeRequest({ restaurantId: R1, restaurantSlug: 'x', email: 'guest@example.com' }),
      harness.deps,
    );
    expect(both.status).toBe(400);

    const phone = await buildLookupEmailHttpResponse(
      makeRequest({ restaurantId: R1, email: 'guest@example.com', phone: '07700900123' }),
      harness.deps,
    );
    expect(phone.status).toBe(400);

    const missingChallenge = await buildLookupEmailHttpResponse(
      makeRequest({ restaurantId: R1, email: 'guest@example.com' }),
      harness.deps,
    );
    expect(missingChallenge.status).toBe(400);
    expect((await missingChallenge.json()).code).toBe('CHALLENGE_FAILED');

    const badChallenge = await buildLookupEmailHttpResponse(
      makeRequest({ restaurantId: R1, email: 'guest@example.com', turnstileToken: 'bad' }),
      harness.deps,
    );
    expect(badChallenge.status).toBe(400);
    expect(harness.afterCount()).toBe(0);
  });
});
