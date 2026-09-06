import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';

import { stagingEnv } from './env';
import { expect, test } from './test';

const staging = stagingEnv();

test('authenticated ops assignment, check-in and checkout preserve terminal state @staging @p0', async ({
  request,
  page,
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
  let bookingId: string | undefined;
  let completed = false;
  try {
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
        name: 'Synthetic Lifecycle Guest',
        email: `lifecycle-${randomUUID()}@nabatable.test`,
        phone: null,
        marketingOptIn: false,
        whatsappOptIn: false,
      },
    });
    expect(created.status()).toBe(201);
    const body = (await created.json()) as { booking?: { id?: string; restaurant_id?: string } };
    bookingId = body.booking?.id;
    expect(bookingId).toBeTruthy();
    expect(body.booking?.restaurant_id).toBe(staging.tenantB.id);
    const detail = await request.get(`${origin}/api/ops/bookings/${bookingId}`, {
      headers,
      maxRedirects: 0,
    });
    expect(detail.status()).toBe(200);
    const persisted = (await detail.json()) as {
      id?: string;
      restaurantId?: string;
      tableAssignments?: Array<{ members: Array<{ tableId: string }> }>;
    };
    expect(persisted.id).toBe(bookingId);
    expect(persisted.restaurantId).toBe(staging.tenantB.id);
    const initialTableIds =
      persisted.tableAssignments?.flatMap((group) =>
        group.members.map((member) => member.tableId),
      ) ?? [];
    const knownSyntheticTableIds = new Set(
      tables.tables?.filter((item) => item.table_number.startsWith('SYN-')).map((item) => item.id),
    );
    for (const initialId of initialTableIds)
      expect(knownSyntheticTableIds.has(initialId)).toBe(true);
    // Create can allocate automatically. Exercise a real manual assignment by releasing
    // only this new booking's synthetic allocation, then assigning that table again.
    const assignmentTableId = initialTableIds[0] ?? table!.id;
    if (initialTableIds.length > 0) {
      const unassigned = await request.delete(
        `${origin}/api/ops/bookings/${bookingId}/assign-tables`,
        {
          headers,
          maxRedirects: 0,
          data: { tableIds: initialTableIds },
        },
      );
      expect(unassigned.status()).toBe(200);
    }
    const assigned = await request.post(`${origin}/api/ops/bookings/${bookingId}/assign-tables`, {
      headers,
      maxRedirects: 0,
      data: { tableIds: [assignmentTableId], idempotencyKey: randomUUID() },
    });
    const assignmentResult = (await assigned.json()) as { code?: string };
    expect(assigned.status(), `assignment code: ${assignmentResult.code ?? 'none'}`).toBe(200);
    const checkIn = await request.post(`${origin}/api/ops/bookings/${bookingId}/check-in`, {
      headers,
      maxRedirects: 0,
      data: {},
    });
    expect(checkIn.status()).toBe(200);
    expect(await checkIn.json()).toMatchObject({ status: 'checked_in' });
    const checkOut = await request.post(`${origin}/api/ops/bookings/${bookingId}/check-out`, {
      headers,
      maxRedirects: 0,
      data: {},
    });
    expect(checkOut.status()).toBe(200);
    expect(await checkOut.json()).toMatchObject({ status: 'completed' });
    completed = true;
    const forbiddenReentry = await request.post(
      `${origin}/api/ops/bookings/${bookingId}/check-in`,
      { headers, maxRedirects: 0, data: {} },
    );
    expect(forbiddenReentry.status()).toBe(409);
    const repeatedCheckout = await request.post(
      `${origin}/api/ops/bookings/${bookingId}/check-out`,
      { headers, maxRedirects: 0, data: {} },
    );
    expect(repeatedCheckout.status()).toBe(200);
    expect(await repeatedCheckout.json()).toMatchObject({ status: 'completed' });
    await page.context().addCookies(
      cookies.map((cookie) => ({
        ...cookie,
        url: origin,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax' as const,
      })),
    );
    const rendered = await page.goto(`${origin}/dashboard?restaurantId=${staging.tenantB.id}`, {
      waitUntil: 'domcontentloaded',
    });
    expect(rendered?.status()).toBeLessThan(400);
    expect(new URL(page.url()).origin).toBe(origin);
    expect(new URL(page.url()).pathname).not.toContain('/auth/');
    await expect(page.getByRole('heading', { name: /today.?s bookings/iu })).toBeVisible();
  } finally {
    if (bookingId && !completed) {
      await request
        .delete(`${origin}/api/ops/bookings/${bookingId}`, { headers, maxRedirects: 0 })
        .catch(() => undefined);
    }
  }
});
