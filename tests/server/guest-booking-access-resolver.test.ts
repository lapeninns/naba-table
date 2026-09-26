/**
 * Guest booking access: booking-scoped capability security pack (design §12,
 * items 8-22 and the logging item 48). Every endpoint that serves one guest
 * booking is exercised through its real route handler and the real resolver,
 * with real bk1 tokens. Only persistence and side effects are faked.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authGetUserMock = vi.hoisted(() => vi.fn());
const listMembershipsMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const softCancelBookingMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const beginBookingModificationFlowMock = vi.hoisted(() => vi.fn());
const getBookingHistoryMock = vi.hoisted(() => vi.fn());
const isUnifiedValidationMock = vi.hoisted(() => vi.fn());
const createValidationServiceMock = vi.hoisted(() => vi.fn());
const db = vi.hoisted(() => ({
  bookings: [] as Array<Record<string, unknown>>,
  queries: [] as Array<{ table: string; filters: Array<[string, unknown]> }>,
}));

vi.mock('@/lib/env', () => ({
  env: {
    node: { env: 'test' },
    reserve: { defaultDurationMinutes: 90 },
    security: { sessionRecoveryAccessTokenSecret: 'test-session-recovery-secret' },
  },
}));

vi.mock('@/lib/posthog/server', () => ({
  captureServerEvent: vi.fn(),
  captureServerException: vi.fn(),
}));

vi.mock('@/server/auth/guards', () => ({
  GuardError: class GuardError extends Error {
    status: number;
    code: string;
    constructor(input: { status: number; code: string; message: string }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
    }
  },
  listUserRestaurantMemberships: listMembershipsMock,
}));

vi.mock('@/server/bookings', () => ({
  BOOKING_TYPES: ['lunch', 'dinner'],
  buildBookingAuditSnapshot: vi.fn(() => ({})),
  deriveEndTimeFromDuration: vi.fn(() => '20:30'),
  inferMealTypeFromTime: vi.fn(() => 'dinner'),
  logAuditEvent: logAuditEventMock,
  softCancelBooking: softCancelBookingMock,
  updateBookingRecord: updateBookingRecordMock,
}));

vi.mock('@/server/bookings/duration', () => ({
  resolveBookingDurationMinutes: vi.fn(async () => ({ durationMinutes: 90 })),
}));

vi.mock('@/server/bookings/modification-flow', () => ({
  beginBookingModificationFlow: beginBookingModificationFlowMock,
}));

vi.mock('@/server/booking', () => ({
  BookingValidationError: class BookingValidationError extends Error {},
  createBookingValidationService: createValidationServiceMock,
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn(),
  withValidationHeaders: vi.fn((init) => init),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCancelledSideEffects: vi.fn(),
  enqueueBookingUpdatedSideEffects: vi.fn(),
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/runtime-policy', () => ({
  getBookingPastTimeGraceMinutes: vi.fn(() => 5),
  getPendingSelfServeGraceMinutes: vi.fn(() => 10),
  isUnifiedBookingValidationEnabled: isUnifiedValidationMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: vi.fn(async (_restaurantId: string, options: { date?: string }) => ({
    date: options.date ?? '2026-07-01',
    timezone: 'Europe/London',
    isClosed: false,
    window: { opensAt: '00:00', closesAt: '23:59' },
    slots: Array.from({ length: 96 }, (_, index) => {
      const hours = String(Math.floor(index / 4)).padStart(2, '0');
      const minutes = String((index % 4) * 15).padStart(2, '0');
      return { value: `${hours}:${minutes}`, display: `${hours}:${minutes}`, disabled: false };
    }),
  })),
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@/server/bookingHistory', () => ({
  getBookingHistory: getBookingHistoryMock,
}));

vi.mock('@/server/reservations/confirmation-pdf', () => ({
  buildReservationConfirmationPdfBuffer: vi.fn(() => Buffer.from('%PDF-test')),
}));

vi.mock('@reserve/shared/validation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isUKPhone: vi.fn(() => true),
}));

vi.mock('@/server/supabase', () => {
  function makeQuery(table: string) {
    const filters: Array<[string, unknown]> = [];
    db.queries.push({ table, filters });
    const matches = () =>
      (table === 'bookings' ? db.bookings : [restaurantRow]).filter((row) =>
        filters.every(([column, value]) => row[column] === value),
      );
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      }),
      maybeSingle: vi.fn(async () => ({ data: matches()[0] ?? null, error: null })),
    };
    return builder;
  }
  const restaurantRow: Record<string, unknown> = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'The Test Arms',
    slug: 'test-arms',
    timezone: 'Europe/London',
  };
  return {
    getDefaultRestaurantId: vi.fn(async () => {
      throw new Error('no default');
    }),
    getRouteHandlerSupabaseClient: vi.fn(async () => ({ auth: { getUser: authGetUserMock } })),
    getServerComponentSupabaseClient: vi.fn(async () => ({ auth: { getUser: authGetUserMock } })),
    getServiceSupabaseClient: vi.fn(() => ({ from: vi.fn((table: string) => makeQuery(table)) })),
    MissingRestaurantContextError: class MissingRestaurantContextError extends Error {},
  };
});

import { isVerifiedBookingOwner } from '@/server/bookings/guest-booking-access';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
import { GET as historyGET } from '@/src/app/api/bookings/[id]/history/route';
import { DELETE, GET, PUT } from '@/src/app/api/bookings/[id]/route';
import { GET as pdfGET } from '@/src/app/api/reservations/[id]/confirmation/route';

import {
  accessCookie,
  guestRequestHeaders,
  mintTestAccessToken,
  TEST_ACCESS_SECRET,
} from './helpers/guestBookingAccess';

const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const A = '65c3207e-318a-4e4b-b82d-1249a720d776';
const B = '75c3207e-318a-4e4b-b82d-1249a720d777';
const C = '85c3207e-318a-4e4b-b82d-1249a720d778';
const NOW = new Date('2026-05-16T12:00:00.000Z');

type Row = Record<string, unknown> & {
  id: string;
  restaurant_id: string;
  customer_email: string;
  customer_phone: string;
};

function makeBooking(overrides: Partial<Row> = {}): Row {
  return {
    id: A,
    restaurant_id: R1,
    customer_id: 'cust-1',
    booking_date: '2026-07-01',
    start_time: '19:00',
    end_time: '20:30',
    start_at: '2026-07-01T18:00:00.000Z',
    end_at: '2026-07-01T19:30:00.000Z',
    reference: 'NB123456',
    party_size: 2,
    booking_type: 'dinner',
    seating_preference: 'any',
    status: 'confirmed',
    checked_in_at: null,
    customer_name: 'Alex Guest',
    customer_email: 'alex@example.com',
    customer_phone: '+447700900123',
    notes: null,
    marketing_opt_in: true,
    auth_user_id: null,
    client_request_id: 'c7a7c6a4-4a4c-4d1d-8f3c-0e2d0cb3b2aa',
    idempotency_key: 'd8a7c6a4-4a4c-4d1d-8f3c-0e2d0cb3b2ab',
    confirmation_token: 'secret-confirmation-token',
    pending_ref: null,
    details: null,
    created_at: '2026-05-01T12:00:00.000Z',
    updated_at: '2026-05-01T12:00:00.000Z',
    ...overrides,
  };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(
  method: string,
  path: string,
  options: {
    cookies?: string[];
    csrf?: boolean;
    body?: unknown;
    ip?: string;
    extra?: Record<string, string>;
  } = {},
) {
  const headers = guestRequestHeaders({
    cookies: options.cookies,
    csrf: options.csrf ?? method !== 'GET',
    extra: { ...(options.extra ?? {}), ...(options.ip ? { 'x-forwarded-for': options.ip } : {}) },
  });
  return new NextRequest(`https://www.nabatable.com${path}`, {
    method,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

function tokenCookieFor(row: Row, cookieBookingId = row.id, now = NOW) {
  return accessCookie(cookieBookingId, mintTestAccessToken(row, { now }));
}

const dashboardBody = { startIso: '2026-07-01T18:00:00.000Z', partySize: 3, notes: 'Window' };
const legacyBody = {
  date: '2026-07-01',
  time: '19:00',
  party: 3,
  bookingType: 'dinner',
  name: 'Alex Guest',
};

type Endpoint = {
  name: string;
  write: boolean;
  call: (id: string, options: Parameters<typeof req>[2]) => Promise<Response>;
};

const endpoints: Endpoint[] = [
  {
    name: 'GET',
    write: false,
    call: (id, o) => GET(req('GET', `/api/bookings/${id}`, o), params(id)),
  },
  {
    name: 'PUT (dashboard schema)',
    write: true,
    call: (id, o) =>
      PUT(req('PUT', `/api/bookings/${id}`, { ...o, body: dashboardBody }), params(id)),
  },
  {
    name: 'PUT (full schema)',
    write: true,
    call: (id, o) => PUT(req('PUT', `/api/bookings/${id}`, { ...o, body: legacyBody }), params(id)),
  },
  {
    name: 'DELETE',
    write: true,
    call: (id, o) => DELETE(req('DELETE', `/api/bookings/${id}`, o), params(id)),
  },
  {
    name: 'history',
    write: false,
    call: (id, o) => historyGET(req('GET', `/api/bookings/${id}/history`, o), params(id)),
  },
  {
    name: 'PDF',
    write: false,
    call: (id, o) => pdfGET(req('GET', `/api/reservations/${id}/confirmation`, o), params(id)),
  },
];

function expectNoWrites() {
  expect(updateBookingRecordMock).not.toHaveBeenCalled();
  expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
  expect(softCancelBookingMock).not.toHaveBeenCalled();
}

function bookingQueries() {
  return db.queries.filter((query) => query.table === 'bookings');
}

let rateBuckets: Map<string, number>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db.bookings = [
    makeBooking(),
    makeBooking({ id: B, customer_email: 'bea@example.com', customer_phone: '+447700900456' }),
    makeBooking({ id: C, restaurant_id: R2, customer_email: 'alex@example.com' }),
  ];
  db.queries = [];
  authGetUserMock.mockReset();
  authGetUserMock.mockResolvedValue({ data: { user: null }, error: null });
  listMembershipsMock.mockReset();
  listMembershipsMock.mockResolvedValue([]);
  rateBuckets = new Map();
  consumeRateLimitMock.mockReset();
  consumeRateLimitMock.mockImplementation(
    async ({ identifier, limit }: { identifier: string; limit: number }) => {
      const count = (rateBuckets.get(identifier) ?? 0) + 1;
      rateBuckets.set(identifier, count);
      return {
        ok: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        resetAt: Date.now() + 60_000,
        source: 'memory',
      };
    },
  );
  recordObservabilityEventMock.mockReset();
  updateBookingRecordMock.mockReset();
  updateBookingRecordMock.mockImplementation(async (_client, id: string, payload: object) => ({
    ...db.bookings.find((row) => row.id === id),
    ...payload,
  }));
  beginBookingModificationFlowMock.mockReset();
  beginBookingModificationFlowMock.mockImplementation(
    async ({ existingBooking, payload }: { existingBooking: Row; payload: object }) => ({
      ...existingBooking,
      ...payload,
    }),
  );
  softCancelBookingMock.mockReset();
  softCancelBookingMock.mockImplementation(async (_client, id: string) => ({
    cancelled: true,
    booking: { ...db.bookings.find((row) => row.id === id), status: 'cancelled' },
  }));
  logAuditEventMock.mockReset();
  getBookingHistoryMock.mockReset();
  getBookingHistoryMock.mockResolvedValue([]);
  isUnifiedValidationMock.mockReset();
  isUnifiedValidationMock.mockReturnValue(false);
  createValidationServiceMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe.each(endpoints)('$name', (endpoint) => {
  it('§8 IDOR same restaurant: a cookie for A does not open B', async () => {
    const response = await endpoint.call(B, { cookies: [tokenCookieFor(makeBooking())] });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('UNAUTHENTICATED');

    const swapped = await endpoint.call(B, { cookies: [tokenCookieFor(makeBooking(), B)] });
    expect(swapped.status).toBe(401);
    expect((await swapped.json()).code).toBe('INVALID_ACCESS_TOKEN');
    expect(swapped.headers.getSetCookie().join('\n')).toContain(`__Host-nt_bk.${B}=;`);
    expectNoWrites();
    expect(getBookingHistoryMock).not.toHaveBeenCalled();
  });

  it('§9 IDOR cross-tenant: the lookup is scoped to the token restaurant', async () => {
    // A token naming booking C but restaurant R1, while C lives at R2.
    const forged = makeBooking({ id: C, restaurant_id: R1 });
    const response = await endpoint.call(C, { cookies: [tokenCookieFor(forged)] });

    expect(response.status).toBe(401);
    expect(
      bookingQueries().some(
        (query) =>
          query.filters.some(([column, value]) => column === 'id' && value === C) &&
          query.filters.some(([column, value]) => column === 'restaurant_id' && value === R1),
      ),
    ).toBe(true);
    expectNoWrites();
  });

  it('§10 contact only: no cookie and no session is 401, and legacy bearers are ignored', async () => {
    const sr2 = createSessionRecoveryAccessToken({
      restaurantId: R1,
      email: 'alex@example.com',
      phone: '+447700900123',
      secret: TEST_ACCESS_SECRET,
      ttlSeconds: 900,
    });

    const plain = await endpoint.call(A, {});
    expect(plain.status).toBe(401);

    const legacy = await endpoint.call(A, {
      cookies: [`sr_access=${sr2}`],
      extra: { 'x-session-recovery-token': sr2 },
    });
    expect(legacy.status).toBe(401);
    expect(legacy.headers.getSetCookie().join('\n')).toMatch(/sr_access=;[^\n]*Max-Age=0/);
    expectNoWrites();
  });

  it('§11 expired token is 410 ACCESS_TOKEN_EXPIRED', async () => {
    const issuedLongAgo = new Date(NOW.getTime() - 40 * 24 * 3600 * 1000);
    const response = await endpoint.call(A, {
      cookies: [tokenCookieFor(makeBooking(), A, issuedLongAgo)],
    });
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe('ACCESS_TOKEN_EXPIRED');
    expect(response.headers.getSetCookie().join('\n')).toContain(`__Host-nt_bk.${A}=;`);
    expectNoWrites();
  });

  it('§11 revoked token (email changed after issue) is 410 and has no effect', async () => {
    const cookie = tokenCookieFor(makeBooking());
    db.bookings[0] = makeBooking({ customer_email: 'changed@example.com' });

    const response = await endpoint.call(A, { cookies: [cookie] });
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe('ACCESS_TOKEN_REVOKED');
    expect(response.headers.getSetCookie().join('\n')).toContain(`__Host-nt_bk.${A}=;`);
    expectNoWrites();
  });

  it('§12 fall-through: a revoked cookie plus a session owner succeeds and clears the cookie', async () => {
    const cookie = tokenCookieFor(makeBooking());
    db.bookings[0] = makeBooking({ customer_email: 'changed@example.com', auth_user_id: 'user-1' });
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'changed@example.com' } },
      error: null,
    });

    const response = await endpoint.call(A, { cookies: [cookie] });
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join('\n')).toContain(`__Host-nt_bk.${A}=;`);
  });

  it('§13 query-string tokens are rejected with 400, even when valid', async () => {
    const token = mintTestAccessToken(makeBooking(), { now: NOW });
    for (const param of ['access_token', 'accessToken', 'token']) {
      const request = req(
        endpoint.write ? 'PUT' : 'GET',
        `/api/bookings/${A}?${param}=${encodeURIComponent(token)}`,
        {
          cookies: [tokenCookieFor(makeBooking())],
          body: endpoint.write ? dashboardBody : undefined,
        },
      );
      const response =
        endpoint.name === 'history'
          ? await historyGET(request, params(A))
          : endpoint.name === 'PDF'
            ? await pdfGET(request, params(A))
            : endpoint.name === 'DELETE'
              ? await DELETE(req('DELETE', `/api/bookings/${A}?${param}=x`, {}), params(A))
              : endpoint.write
                ? await PUT(request, params(A))
                : await GET(request, params(A));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe('ACCESS_TOKEN_IN_URL_REJECTED');
    }
    expectNoWrites();
  });

  it('§16 no guest response carries idempotency_key, client_request_id or confirmation_token', async () => {
    const response = await endpoint.call(A, { cookies: [tokenCookieFor(makeBooking())] });
    expect(response.status).toBe(200);
    if (endpoint.name === 'PDF') return;
    const text = await response.text();
    expect(text).not.toContain('idempotency_key');
    expect(text).not.toContain('client_request_id');
    expect(text).not.toContain('confirmation_token');
    expect(text).not.toContain('d8a7c6a4-4a4c-4d1d-8f3c-0e2d0cb3b2ab');
    expect(text).not.toContain('secret-confirmation-token');
    // §16 masking on the token path.
    expect(text).not.toContain('alex@example.com');
    expect(text).not.toContain('7700900123');
  });
});

describe.each(endpoints.filter((endpoint) => endpoint.write))('$name CSRF', (endpoint) => {
  it('§14 is 403 without the double-submit token on the token path', async () => {
    const response = await endpoint.call(A, {
      cookies: [tokenCookieFor(makeBooking())],
      csrf: false,
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_INVALID');
    expectNoWrites();
  });

  it('§14 is 403 without the double-submit token on the session path', async () => {
    db.bookings[0] = makeBooking({ auth_user_id: 'user-1' });
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'alex@example.com' } },
      error: null,
    });
    const response = await endpoint.call(A, { csrf: false });
    expect(response.status).toBe(403);
    expectNoWrites();
  });
});

describe('rate limits (§15)', () => {
  it('limits token writes per booking: the 11th write in a minute is 429', async () => {
    const cookie = tokenCookieFor(makeBooking());
    const statuses: number[] = [];
    for (let index = 0; index < 11; index += 1) {
      const response = await PUT(
        req('PUT', `/api/bookings/${A}`, { cookies: [cookie], body: dashboardBody }),
        params(A),
      );
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(consumeRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: `bookings:guest-token-write:${A}`, limit: 10 }),
    );
  });

  it('keys token reads by booking, not by IP', async () => {
    const cookie = tokenCookieFor(makeBooking());
    for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
      await GET(req('GET', `/api/bookings/${A}`, { cookies: [cookie], ip }), params(A));
    }
    expect(rateBuckets.get(`bookings:guest-token-read:${A}`)).toBe(3);
    expect([...rateBuckets.keys()].some((key) => key.includes('198.51.100'))).toBe(false);
  });

  it('does not limit 50 reads spread over 5 bookings from one IP (server prefetch)', async () => {
    const ids = [
      A,
      B,
      C,
      'a5c3207e-318a-4e4b-b82d-1249a720d770',
      'b5c3207e-318a-4e4b-b82d-1249a720d771',
    ];
    db.bookings = ids.map((id) => makeBooking({ id }));
    const statuses: number[] = [];
    for (let round = 0; round < 10; round += 1) {
      for (const id of ids) {
        const row = makeBooking({ id });
        const response = await GET(
          req('GET', `/api/bookings/${id}`, { cookies: [tokenCookieFor(row)], ip: '203.0.113.9' }),
          params(id),
        );
        statuses.push(response.status);
      }
    }
    expect(statuses).toHaveLength(50);
    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});

describe('token path responses', () => {
  it('§16 GET masks contact details for token access and shows them to the session owner', async () => {
    const tokenResponse = await GET(
      req('GET', `/api/bookings/${A}`, { cookies: [tokenCookieFor(makeBooking())] }),
      params(A),
    );
    const tokenBody = await tokenResponse.json();
    expect(tokenBody.booking).toMatchObject({
      id: A,
      customer_email: '',
      customer_phone: '***0123',
      customer_name: 'A***',
      restaurants: { name: 'The Test Arms', slug: 'test-arms' },
    });

    db.bookings[0] = makeBooking({ auth_user_id: 'user-1' });
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'alex@example.com' } },
      error: null,
    });
    const sessionResponse = await GET(req('GET', `/api/bookings/${A}`), params(A));
    const sessionBody = await sessionResponse.json();
    expect(sessionBody.booking.customer_email).toBe('alex@example.com');
    expect(sessionBody.booking).not.toHaveProperty('idempotency_key');
  });

  it('§17 a token PUT that changes email or phone is 422 and writes nothing', async () => {
    const cookie = tokenCookieFor(makeBooking());
    const emailChange = await PUT(
      req('PUT', `/api/bookings/${A}`, {
        cookies: [cookie],
        body: { ...legacyBody, email: 'attacker@example.com' },
      }),
      params(A),
    );
    expect(emailChange.status).toBe(422);
    expect((await emailChange.json()).code).toBe('CONTACT_CHANGE_NOT_ALLOWED');

    const phoneChange = await PUT(
      req('PUT', `/api/bookings/${A}`, {
        cookies: [cookie],
        body: { ...legacyBody, phone: '+447700900999' },
      }),
      params(A),
    );
    expect(phoneChange.status).toBe(422);
    expectNoWrites();
  });

  it('§17 omitted contact persists the stored contact', async () => {
    const withoutContact = legacyBody;
    const response = await PUT(
      req('PUT', `/api/bookings/${A}`, {
        cookies: [tokenCookieFor(makeBooking())],
        body: withoutContact,
      }),
      params(A),
    );
    expect(response.status).toBe(200);
    const persisted = beginBookingModificationFlowMock.mock.calls[0]?.[0]?.payload;
    expect(persisted).toMatchObject({
      customer_email: 'alex@example.com',
      customer_phone: '+447700900123',
    });
  });

  it('§18 a token PUT audits as guest-link with no user id and guest validation roles', async () => {
    isUnifiedValidationMock.mockReturnValue(true);
    const updateWithEnforcement = vi.fn(async () => ({
      booking: makeBooking({ notes: 'Window' }),
    }));
    const validateUpdate = vi.fn(async () => ({ response: { ok: true } }));
    createValidationServiceMock.mockReturnValue({ updateWithEnforcement, validateUpdate });

    const response = await PUT(
      req('PUT', `/api/bookings/${A}`, {
        cookies: [tokenCookieFor(makeBooking())],
        body: { startIso: '2026-07-01T18:00:00.000Z', partySize: 2, notes: 'Window' },
      }),
      params(A),
    );
    expect(response.status).toBe(200);
    expect(updateWithEnforcement).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ actorId: 'guest-link', actorRoles: ['guest'] }),
    );
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actor: 'guest-link',
        metadata: expect.objectContaining({ actor_user_id: null, actor_email: null }),
      }),
    );
  });

  it('§22 cancelled booking: GET shows it, PUT is 409, DELETE is an idempotent 200', async () => {
    db.bookings[0] = makeBooking({ status: 'cancelled' });
    const cookie = tokenCookieFor(makeBooking());

    const read = await GET(req('GET', `/api/bookings/${A}`, { cookies: [cookie] }), params(A));
    expect(read.status).toBe(200);
    expect((await read.json()).booking.status).toBe('cancelled');

    const update = await PUT(
      req('PUT', `/api/bookings/${A}`, { cookies: [cookie], body: dashboardBody }),
      params(A),
    );
    expect(update.status).toBe(409);

    const cancel = await DELETE(
      req('DELETE', `/api/bookings/${A}`, { cookies: [cookie] }),
      params(A),
    );
    expect(cancel.status).toBe(200);
    expect(await cancel.json()).toEqual({ id: A, status: 'cancelled' });
    expectNoWrites();
  });

  it('DELETE through the token cancels only that booking and audits guest-link', async () => {
    const response = await DELETE(
      req('DELETE', `/api/bookings/${A}`, { cookies: [tokenCookieFor(makeBooking())] }),
      params(A),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: A, status: 'cancelled' });
    expect(softCancelBookingMock).toHaveBeenCalledWith(expect.anything(), A, { restaurantId: R1 });
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actor: 'guest-link' }),
    );
  });
});

describe('staff precedence (§19)', () => {
  // Starts in 15 minutes: the guest self-service lock refuses, staff may still edit.
  const soon = makeBooking({
    booking_date: '2026-05-16',
    start_time: '13:15',
    end_time: '14:45',
    start_at: '2026-05-16T12:15:00.000Z',
    end_at: '2026-05-16T13:45:00.000Z',
  });
  const soonBody = { startIso: '2026-05-16T12:15:00.000Z', partySize: 3 };

  beforeEach(() => {
    db.bookings[0] = soon;
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'staff-1', email: 'staff@venue.example' } },
      error: null,
    });
  });

  it('a member of the booking restaurant takes the staff path despite a guest cookie', async () => {
    listMembershipsMock.mockResolvedValue([{ restaurant_id: R1 }]);
    const response = await PUT(
      req('PUT', `/api/bookings/${A}`, { cookies: [tokenCookieFor(soon)], body: soonBody }),
      params(A),
    );
    expect(response.status).toBe(200);
    expect(beginBookingModificationFlowMock).toHaveBeenCalled();
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
  });

  it('a member of another restaurant only goes through the guest path', async () => {
    listMembershipsMock.mockResolvedValue([{ restaurant_id: R2 }]);
    const response = await PUT(
      req('PUT', `/api/bookings/${A}`, { cookies: [tokenCookieFor(soon)], body: soonBody }),
      params(A),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('STARTING_SOON');
    expectNoWrites();
  });
});

describe('session ownership predicate (§20)', () => {
  const verifiedUser = {
    id: 'user-9',
    email: 'Alex@Example.com',
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
  };

  it('with email match disabled, a verified email match is not ownership', async () => {
    authGetUserMock.mockResolvedValue({ data: { user: verifiedUser }, error: null });
    const response = await GET(req('GET', `/api/bookings/${A}`), params(A));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('BOOKING_NOT_FOUND');
  });

  it('an auth_user_id match is ownership', async () => {
    db.bookings[0] = makeBooking({ auth_user_id: 'user-9' });
    authGetUserMock.mockResolvedValue({ data: { user: verifiedUser }, error: null });
    const response = await GET(req('GET', `/api/bookings/${A}`), params(A));
    expect(response.status).toBe(200);
  });

  it('with email match enabled: verified match reads and updates, never cancels', () => {
    const booking = { auth_user_id: null, customer_email: 'alex@example.com' };
    expect(isVerifiedBookingOwner(booking, verifiedUser, 'read', true)).toBe(true);
    expect(isVerifiedBookingOwner(booking, verifiedUser, 'update', true)).toBe(true);
    expect(isVerifiedBookingOwner(booking, verifiedUser, 'cancel', true)).toBe(false);
    expect(
      isVerifiedBookingOwner(booking, { ...verifiedUser, email_confirmed_at: null }, 'read', true),
    ).toBe(false);
    expect(isVerifiedBookingOwner(booking, verifiedUser, 'read', false)).toBe(false);
    expect(
      isVerifiedBookingOwner({ ...booking, auth_user_id: 'user-9' }, verifiedUser, 'cancel', false),
    ).toBe(true);
  });
});

describe('denial logging (§48)', () => {
  it('booking_access.denied events carry no email or phone digits', async () => {
    const cookie = tokenCookieFor(makeBooking());
    db.bookings[0] = makeBooking({ customer_email: 'changed@example.com' });
    await GET(req('GET', `/api/bookings/${A}`, { cookies: [cookie] }), params(A));
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-2', email: 'someone@example.com' } },
      error: null,
    });
    await GET(req('GET', `/api/bookings/${B}`), params(B));

    const events = recordObservabilityEventMock.mock.calls.map((call) => call[0]);
    expect(events.some((event) => event.eventType === 'booking_access.denied')).toBe(true);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toMatch(/7700900/);
  });
});
