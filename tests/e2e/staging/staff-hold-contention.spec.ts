import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { stagingEnv } from './env';
import { expect, test } from './test';

const staging = stagingEnv();
type BookingDetail = {
  id?: string;
  restaurantId?: string;
  status?: string;
  tableAssignments?: Array<{ members: Array<{ tableId: string }> }>;
};
type Quote = {
  holdId: string | null;
  candidate: { tableIds: string[] } | null;
  reason?: string;
};

test('concurrent staff table holds produce exactly one assignment on one synthetic table @staging @p0', async ({
  request,
}) => {
  const rawCookies = staging.optional.STAGING_TENANT_B_SESSION_COOKIES;
  test.skip(!rawCookies, 'STAGING_TENANT_B_SESSION_COOKIES not provided');
  expect(staging.optional.STAGING_EMAIL_MOCK_VERIFIED).toBe('true');
  expect(staging.optional.STAGING_SMS_SINK_VERIFIED).toBe('true');
  // Runner obtains these through Supabase SSR auth.setSession with a genuine fixture session.
  // Neither the cookie values nor a storage-state artifact are logged or persisted here.
  const parsed: unknown = JSON.parse(rawCookies ?? '[]');
  if (!Array.isArray(parsed) || parsed.length === 0)
    throw new Error('Synthetic ops session cookies are required');
  const cookies = parsed.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('name' in entry) ||
      !('value' in entry) ||
      typeof entry.name !== 'string' ||
      typeof entry.value !== 'string' ||
      !/^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/u.test(entry.name) ||
      /[;\r\n]/u.test(entry.value)
    ) {
      throw new Error('Invalid synthetic ops session cookie shape');
    }
    return { name: entry.name, value: entry.value };
  });
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  const origin = new URL(staging.opsUrl).origin;
  const bootstrap = await request.get(
    `${origin}/api/ops/tables?restaurantId=${staging.tenantB.id}`,
    {
      headers: { cookie: cookieHeader },
      maxRedirects: 0,
    },
  );
  expect(bootstrap.status()).toBe(200);
  const csrfCookie = bootstrap
    .headersArray()
    .find(
      (header) =>
        header.name.toLowerCase() === 'set-cookie' && header.value.startsWith('sr-csrf-token='),
    );
  const csrfToken = csrfCookie?.value.split(';')[0]?.slice('sr-csrf-token='.length);
  if (!csrfToken) throw new Error('Staging proxy did not issue the CSRF cookie');
  const headers = {
    cookie: `${cookieHeader}; sr-csrf-token=${csrfToken}`,
    'x-csrf-token': csrfToken,
    origin,
  };
  const tables = (await bootstrap.json()) as {
    tables?: Array<{ id: string; table_number: string; capacity: number }>;
  };
  const table = tables.tables?.find(
    (item) => item.table_number.startsWith('SYN-') && item.capacity >= 2,
  );
  expect(table?.id).toBeTruthy();
  const now = DateTime.now().setZone('Europe/London');
  const time = now.hour < 13 ? '14:00' : '20:30';
  if (
    now >=
    DateTime.fromISO(`${now.toISODate()}T${time}`, { zone: 'Europe/London' }).minus({ minutes: 30 })
  ) {
    throw new Error('Synthetic same-day lifecycle requires a future fixture service slot');
  }

  if (!table || !tables.tables) throw new Error('Synthetic target table required');
  const targetId = table.id;
  const avoidTables = tables.tables.filter((item) => item.id !== targetId).map((item) => item.id);
  const syntheticIds = new Set(
    tables.tables.filter((item) => item.table_number.startsWith('SYN-')).map((item) => item.id),
  );
  const bookingIds: string[] = [];
  const readBooking = async (bookingId: string): Promise<BookingDetail> => {
    const response = await request.get(`${origin}/api/ops/bookings/${bookingId}`, {
      headers,
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    const detail = (await response.json()) as BookingDetail;
    expect(detail.id).toBe(bookingId);
    expect(detail.restaurantId).toBe(staging.tenantB.id);
    return detail;
  };
  const assignedIds = (detail: BookingDetail) =>
    detail.tableAssignments?.flatMap((group) => group.members.map((member) => member.tableId)) ??
    [];
  try {
    // Sequential setup frees the same inventory before the next synthetic create.
    for (let index = 0; index < 2; index += 1) {
      const created = await request.post(`${origin}/api/ops/bookings`, {
        headers: { ...headers, 'Idempotency-Key': randomUUID() },
        maxRedirects: 0,
        data: {
          restaurantId: staging.tenantB.id,
          date: now.toISODate(),
          time,
          party: 2,
          bookingType: time === '14:00' ? 'lunch' : 'dinner',
          seating: 'any',
          name: 'Synthetic Hold Guest',
          email: `hold-${randomUUID()}@nabatable.test`,
          phone: null,
          marketingOptIn: false,
          whatsappOptIn: false,
        },
      });
      expect(created.status()).toBe(201);
      const body = (await created.json()) as { booking?: { id?: string } };
      const bookingId = body.booking?.id;
      if (!bookingId) throw new Error('Synthetic create did not return booking ID');
      bookingIds.push(bookingId);
      await writeFile(
        test.info().outputPath('synthetic-hold-fixtures.json'),
        JSON.stringify({ restaurantId: staging.tenantB.id, bookingIds }),
      );
      const allocated = assignedIds(await readBooking(bookingId));
      expect(allocated.length).toBeGreaterThan(0);
      for (const id of allocated) expect(syntheticIds.has(id)).toBe(true);
      const unassigned = await request.delete(
        `${origin}/api/ops/bookings/${bookingId}/assign-tables`,
        {
          headers,
          maxRedirects: 0,
          data: { tableIds: allocated },
        },
      );
      expect(unassigned.status()).toBe(200);
      expect(await unassigned.json()).toMatchObject({
        success: true,
        removedCount: allocated.length,
      });
      const pending = await readBooking(bookingId);
      expect(pending.status).toBe('pending');
      expect(assignedIds(pending)).toEqual([]);
    }
    const responses = await Promise.all(
      bookingIds.map((bookingId) =>
        request.post(`${origin}/api/staff/auto/quote`, {
          headers,
          maxRedirects: 0,
          data: { bookingId, maxTables: 1, avoidTables, holdTtlSeconds: 120 },
        }),
      ),
    );
    const quotes: Quote[] = [];
    for (const response of responses) {
      // Exhausted candidates are reported as a successful quote with no hold.
      expect(response.status()).toBe(200);
      quotes.push((await response.json()) as Quote);
    }
    const winners = quotes
      .map((quote, index) => ({ quote, index }))
      .filter(({ quote }) => Boolean(quote.holdId));
    expect(winners).toHaveLength(1);
    const winner = winners[0]!;
    expect(winner.quote.candidate?.tableIds).toEqual([targetId]);
    const loserIndex = winner.index === 0 ? 1 : 0;
    expect(quotes[loserIndex]).toMatchObject({ holdId: null, candidate: null });
    expect(quotes[loserIndex]?.reason).toBeTruthy();
    const confirmed = await request.post(`${origin}/api/staff/auto/confirm`, {
      headers,
      maxRedirects: 0,
      data: {
        holdId: winner.quote.holdId,
        bookingId: bookingIds[winner.index],
        idempotencyKey: randomUUID(),
      },
    });
    expect(confirmed.status()).toBe(200);
    expect(await confirmed.json()).toMatchObject({
      holdId: winner.quote.holdId,
      bookingId: bookingIds[winner.index],
    });
    const readbacks = await Promise.all(bookingIds.map(readBooking));
    // Staff auto/confirm converts a hold to assignments without requesting a
    // booking status transition. atomicConfirmAndTransition is the separate
    // booking-confirmation flow; this route must preserve the pending statuses.
    expect(readbacks.filter((booking) => assignedIds(booking).length > 0)).toHaveLength(1);
    expect(readbacks[winner.index]?.status).toBe('pending');
    expect(assignedIds(readbacks[winner.index]!)).toEqual([targetId]);
    expect(readbacks[loserIndex]?.status).toBe('pending');
    expect(assignedIds(readbacks[loserIndex]!)).toEqual([]);
  } finally {
    // Runner uses only these exact synthetic IDs for residual hold cleanup, including
    // failed quote/confirm attempts. Cancellation now releases holds atomically;
    // the runner independently verifies there are no residual fixture holds.
    await test.info().attach('synthetic-hold-fixtures', {
      body: Buffer.from(JSON.stringify({ restaurantId: staging.tenantB.id, bookingIds })),
      contentType: 'application/json',
    });
    const cleanup = await Promise.allSettled(
      bookingIds.map(async (bookingId) => {
        const cancelled = await request.delete(`${origin}/api/ops/bookings/${bookingId}`, {
          headers,
          maxRedirects: 0,
        });
        expect(cancelled.status()).toBe(200);
        expect(await cancelled.json()).toMatchObject({ id: bookingId, status: 'cancelled' });
        const readback = await readBooking(bookingId);
        expect(readback.status).toBe('cancelled');
        expect(assignedIds(readback)).toEqual([]);
      }),
    );
    const failures = cleanup.filter((result) => result.status === 'rejected');
    expect(
      failures.length,
      'Every synthetic hold booking must cancel and release assignments',
    ).toBe(0);
  }
});
