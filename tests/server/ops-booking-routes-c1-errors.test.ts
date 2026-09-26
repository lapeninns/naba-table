import { DateTime } from 'luxon';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * C1 error-contract sweep for the staff auto-assign and ops booking/customer/dashboard
 * read routes: every error body is `{ error, code, message }`, and unexpected failures
 * never echo database or provider text (or guest PII) to the client or the log.
 */

const mocks = vi.hoisted(() => ({
  getRouteHandlerSupabaseClient: vi.fn(),
  getServiceSupabaseClient: vi.fn(),
  getTenantServiceSupabaseClient: vi.fn(),
  fetchUserMemberships: vi.fn(),
  requireMembershipForRestaurant: vi.fn(),
  requireApiRateLimit: vi.fn(),
  confirmHold: vi.fn(),
  quoteTables: vi.fn(),
  listBookingHistory: vi.fn(),
  getBookingStatusSummary: vi.fn(),
  getTodayBookingsSummary: vi.fn(),
  getBookingsHeatmap: vi.fn(),
  getTodayBookingChanges: vi.fn(),
  getManualAssignmentContext: vi.fn(),
  getCustomersWithHistory: vi.fn(),
  getAllCustomersWithHistory: vi.fn(),
  requireDashboardAccess: vi.fn(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: mocks.getRouteHandlerSupabaseClient,
  getServiceSupabaseClient: mocks.getServiceSupabaseClient,
  getTenantServiceSupabaseClient: mocks.getTenantServiceSupabaseClient,
}));
vi.mock('@/server/team/access', () => ({
  fetchUserMemberships: mocks.fetchUserMemberships,
  requireMembershipForRestaurant: mocks.requireMembershipForRestaurant,
}));
vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: mocks.requireApiRateLimit,
}));
vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: (_req: unknown, handler: () => Promise<Response>) => handler(),
}));
vi.mock('@/lib/posthog/server', () => ({ captureServerException: vi.fn() }));
vi.mock('@/server/capacity/engine', () => ({
  confirmHold: mocks.confirmHold,
  quoteTables: mocks.quoteTables,
}));
vi.mock('@/server/ops/booking-lifecycle/history', () => ({
  listBookingHistory: mocks.listBookingHistory,
}));
vi.mock('@/server/ops/booking-lifecycle/summary', () => ({
  getBookingStatusSummary: mocks.getBookingStatusSummary,
}));
vi.mock('@/server/ops/bookings', () => ({
  getTodayBookingsSummary: mocks.getTodayBookingsSummary,
  getBookingsHeatmap: mocks.getBookingsHeatmap,
  getTodayBookingChanges: mocks.getTodayBookingChanges,
}));
vi.mock('@/server/capacity/table-assignment/manual', () => ({
  getManualAssignmentContext: mocks.getManualAssignmentContext,
}));
vi.mock('@/server/ops/customers', () => ({
  getCustomersWithHistory: mocks.getCustomersWithHistory,
  getAllCustomersWithHistory: mocks.getAllCustomersWithHistory,
}));
vi.mock('@/src/app/api/ops/dashboard/_shared', () => ({
  requireDashboardAccess: mocks.requireDashboardAccess,
  buildDashboardAccessErrorResponse: vi.fn(),
}));

import { HoldConflictError, HoldNotFoundError } from '@/server/capacity/holds';
import { ServiceNotFoundError } from '@/server/capacity/policy';
import { GET as historyGET } from '@/src/app/api/ops/bookings/[id]/history/route';
import { GET as manualContextGET } from '@/src/app/api/ops/bookings/[id]/manual-context/route';
import { GET as bookingsExportGET } from '@/src/app/api/ops/bookings/export/route';
import { GET as statusSummaryGET } from '@/src/app/api/ops/bookings/status-summary/route';
import { GET as customersExportGET } from '@/src/app/api/ops/customers/export/route';
import { GET as customersGET } from '@/src/app/api/ops/customers/route';
import { GET as dashboardChangesGET } from '@/src/app/api/ops/dashboard/changes/route';
import { GET as dashboardHeatmapGET } from '@/src/app/api/ops/dashboard/heatmap/route';
import { GET as dashboardSummaryGET } from '@/src/app/api/ops/dashboard/summary/route';
import { POST as confirmPOST } from '@/src/app/api/staff/auto/confirm/route';
import { POST as quotePOST } from '@/src/app/api/staff/auto/quote/route';

const SECRET = 'SECRET_DB_DETAIL owner@example.com';
const USER_ID = '4f56a7b9-3ea8-4bc3-a539-508df4d9ebbb';
const RESTAURANT_ID = '6f4ddf92-6c8b-4ed2-a419-f8af95d7c111';
const HOLD_ID = '994a7b07-6046-4a79-a391-e2784c78f2c4';
const BOOKING_ID = '65c3207e-318a-4e4b-b82d-1249a720d776';
const ORIGIN = 'https://app.nabatable.com';

type LookupResult = { data: unknown; error: { message: string; code?: string } | null };

function chain(result: LookupResult) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return query;
}

function routeClient(overrides: Partial<Record<string, LookupResult>> = {}, authError?: unknown) {
  const tables: Record<string, LookupResult> = {
    table_holds: { data: { id: HOLD_ID, restaurant_id: RESTAURANT_ID }, error: null },
    bookings: { data: { id: BOOKING_ID, restaurant_id: RESTAURANT_ID }, error: null },
    restaurant_memberships: { data: { role: 'host' }, error: null },
    ...overrides,
  };
  return {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue(
          authError
            ? { data: { user: null }, error: authError }
            : { data: { user: { id: USER_ID } }, error: null },
        ),
    },
    from: vi.fn((table: string) => chain(tables[table] ?? { data: null, error: null })),
  };
}

function jsonPost(path: string, body: unknown) {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const confirmBody = { holdId: HOLD_ID, bookingId: BOOKING_ID, idempotencyKey: 'confirm-once' };

let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];

function loggedText(): string {
  return JSON.stringify(consoleSpies.map((spy) => spy.mock.calls));
}

async function expectNoLeak(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  expect(text).not.toContain('SECRET_DB_DETAIL');
  expect(text).not.toContain('owner@example.com');
  expect(loggedText()).not.toContain('owner@example.com');
  return JSON.parse(text) as Record<string, unknown>;
}

function expectC1(body: Record<string, unknown>, code: string) {
  expect(body.code).toBe(code);
  expect(typeof body.error).toBe('string');
  expect(body.message).toBe(body.error);
}

beforeEach(() => {
  consoleSpies = (['error', 'warn', 'info', 'log'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => undefined),
  );
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getRouteHandlerSupabaseClient.mockResolvedValue(routeClient());
  mocks.getServiceSupabaseClient.mockReturnValue(routeClient());
  mocks.getTenantServiceSupabaseClient.mockReturnValue({ service: true });
  mocks.fetchUserMemberships.mockResolvedValue([
    { restaurant_id: RESTAURANT_ID, restaurants: { name: 'QA Venue' } },
  ]);
  mocks.requireMembershipForRestaurant.mockResolvedValue({ restaurants: { name: 'QA Venue' } });
  mocks.requireApiRateLimit.mockResolvedValue(null);
  mocks.requireDashboardAccess.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
});

describe('unexpected failures return a generic 500 without the raw error text', () => {
  const dashboardQuery = `restaurantId=${RESTAURANT_ID}`;
  const cases: [string, () => void, () => Promise<Response>][] = [
    [
      'staff auto confirm',
      () => mocks.confirmHold.mockRejectedValue(new Error(SECRET)),
      () => confirmPOST(jsonPost('/api/staff/auto/confirm', confirmBody)),
    ],
    [
      'staff auto quote',
      () => mocks.quoteTables.mockRejectedValue(new Error(SECRET)),
      () => quotePOST(jsonPost('/api/staff/auto/quote', { bookingId: BOOKING_ID })),
    ],
    [
      'booking history (history read)',
      () => mocks.listBookingHistory.mockRejectedValue(new Error(SECRET)),
      () =>
        historyGET(new NextRequest(`${ORIGIN}/api/ops/bookings/${BOOKING_ID}/history`), {
          params: Promise.resolve({ id: BOOKING_ID }),
        }),
    ],
    [
      'booking history (booking lookup)',
      () =>
        mocks.getServiceSupabaseClient.mockReturnValue(
          routeClient({ bookings: { data: null, error: { message: SECRET, code: '42501' } } }),
        ),
      () =>
        historyGET(new NextRequest(`${ORIGIN}/api/ops/bookings/${BOOKING_ID}/history`), {
          params: Promise.resolve({ id: BOOKING_ID }),
        }),
    ],
    [
      'booking status summary',
      () => mocks.getBookingStatusSummary.mockRejectedValue(new Error(SECRET)),
      () =>
        statusSummaryGET(
          new NextRequest(
            `${ORIGIN}/api/ops/bookings/status-summary?restaurantId=${RESTAURANT_ID}&from=2026-07-01&to=2026-07-31`,
          ),
        ),
    ],
    [
      'bookings export',
      () => mocks.getTodayBookingsSummary.mockRejectedValue(new Error(SECRET)),
      () =>
        bookingsExportGET(new NextRequest(`${ORIGIN}/api/ops/bookings/export?${dashboardQuery}`)),
    ],
    [
      'manual context',
      () => mocks.getManualAssignmentContext.mockRejectedValue(new Error(SECRET)),
      () =>
        manualContextGET(
          new NextRequest(`${ORIGIN}/api/ops/bookings/${BOOKING_ID}/manual-context`),
          { params: Promise.resolve({ id: BOOKING_ID }) },
        ),
    ],
    [
      'customers list',
      () => mocks.getCustomersWithHistory.mockRejectedValue(new Error(SECRET)),
      () => customersGET(new NextRequest(`${ORIGIN}/api/ops/customers`)),
    ],
    [
      'customers export',
      () => mocks.getAllCustomersWithHistory.mockRejectedValue(new Error(SECRET)),
      () => customersExportGET(new NextRequest(`${ORIGIN}/api/ops/customers/export`)),
    ],
    [
      'dashboard summary',
      () => mocks.getTodayBookingsSummary.mockRejectedValue(new Error(SECRET)),
      () =>
        dashboardSummaryGET(
          new NextRequest(`${ORIGIN}/api/ops/dashboard/summary?${dashboardQuery}`),
        ),
    ],
    [
      'dashboard heatmap',
      () => mocks.getBookingsHeatmap.mockRejectedValue(new Error(SECRET)),
      () =>
        dashboardHeatmapGET(
          new NextRequest(
            `${ORIGIN}/api/ops/dashboard/heatmap?${dashboardQuery}&startDate=2026-07-01&endDate=2026-07-31`,
          ),
        ),
    ],
    [
      'dashboard changes',
      () => mocks.getTodayBookingChanges.mockRejectedValue(new Error(SECRET)),
      () =>
        dashboardChangesGET(
          new NextRequest(`${ORIGIN}/api/ops/dashboard/changes?${dashboardQuery}`),
        ),
    ],
  ];

  it.each(cases)('%s', async (_label, arrange, act) => {
    arrange();
    const response = await act();

    expect(response.status).toBe(500);
    const body = await expectNoLeak(response);
    expectC1(body, 'INTERNAL_ERROR');
  });

  it.each([
    ['bookings', 'BOOKING_LOOKUP_FAILED', 'Failed to load booking'],
    ['restaurant_memberships', 'ACCESS_LOOKUP_FAILED', 'Failed to verify access'],
  ])(
    'manual context keeps its stable code when the %s lookup fails',
    async (table, code, message) => {
      mocks.getRouteHandlerSupabaseClient.mockResolvedValue(
        routeClient({ [table]: { data: null, error: { message: SECRET, code: '42501' } } }),
      );

      const response = await manualContextGET(
        new NextRequest(`${ORIGIN}/api/ops/bookings/${BOOKING_ID}/manual-context`),
        { params: Promise.resolve({ id: BOOKING_ID }) },
      );

      expect(response.status).toBe(500);
      const body = await expectNoLeak(response);
      expect(body).toEqual({ error: message, code, message });
    },
  );

  it('maps an unexpected session failure to the C1 shape without the auth error text', async () => {
    mocks.getRouteHandlerSupabaseClient.mockResolvedValue(
      routeClient({}, { status: 502, message: SECRET }),
    );

    const response = await customersGET(new NextRequest(`${ORIGIN}/api/ops/customers`));

    expect(response.status).toBe(500);
    const body = await expectNoLeak(response);
    expectC1(body, 'SESSION_RESOLUTION_FAILED');
  });
});

describe('staff auto routes: domain codes', () => {
  it('confirm returns 400 VALIDATION_FAILED with field messages for a bad payload', async () => {
    const response = await confirmPOST(
      jsonPost('/api/staff/auto/confirm', { ...confirmBody, holdId: 'nope' }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expectC1(body, 'VALIDATION_FAILED');
    expect(body.fields).toHaveProperty('holdId');
    expect(body).not.toHaveProperty('details');
  });

  it('confirm returns 401 UNAUTHENTICATED without a session', async () => {
    mocks.getRouteHandlerSupabaseClient.mockResolvedValue(
      routeClient({}, { status: 401, message: 'jwt expired' }),
    );

    const response = await confirmPOST(jsonPost('/api/staff/auto/confirm', confirmBody));

    expect(response.status).toBe(401);
    expectC1((await response.json()) as Record<string, unknown>, 'UNAUTHENTICATED');
  });

  it('confirm returns 404 HOLD_NOT_FOUND when the hold vanished during confirm', async () => {
    mocks.confirmHold.mockRejectedValue(new HoldNotFoundError(SECRET));

    const response = await confirmPOST(jsonPost('/api/staff/auto/confirm', confirmBody));

    expect(response.status).toBe(404);
    const body = await expectNoLeak(response);
    expect(body).toEqual({
      error: 'Hold not found',
      code: 'HOLD_NOT_FOUND',
      message: 'Hold not found',
    });
  });

  it('confirm returns 403 FORBIDDEN for callers outside the hold restaurant', async () => {
    mocks.getRouteHandlerSupabaseClient.mockResolvedValue(
      routeClient({ restaurant_memberships: { data: null, error: null } }),
    );

    const response = await confirmPOST(jsonPost('/api/staff/auto/confirm', confirmBody));

    expect(response.status).toBe(403);
    expectC1((await response.json()) as Record<string, unknown>, 'FORBIDDEN');
    expect(mocks.confirmHold).not.toHaveBeenCalled();
  });

  it('quote returns 409 HOLD_CONFLICT with the conflicting hold id in details only', async () => {
    mocks.quoteTables.mockRejectedValue(new HoldConflictError(SECRET, HOLD_ID));

    const response = await quotePOST(jsonPost('/api/staff/auto/quote', { bookingId: BOOKING_ID }));

    expect(response.status).toBe(409);
    const body = await expectNoLeak(response);
    expectC1(body, 'HOLD_CONFLICT');
    expect(body.details).toEqual({ holdId: HOLD_ID });
  });

  it('quote keeps 422 for a missing service window with fixed copy', async () => {
    mocks.quoteTables.mockRejectedValue(
      new ServiceNotFoundError(DateTime.fromISO('2026-07-01T23:59:00Z'), SECRET),
    );

    const response = await quotePOST(jsonPost('/api/staff/auto/quote', { bookingId: BOOKING_ID }));

    expect(response.status).toBe(422);
    const body = await expectNoLeak(response);
    expectC1(body, 'SERVICE_NOT_FOUND');
  });

  it('quote returns 409 QUOTE_FAILED when a hold comes back without a candidate', async () => {
    mocks.quoteTables.mockResolvedValue({
      hold: { id: HOLD_ID },
      candidate: null,
      alternates: [],
      nextTimes: [],
    });

    const response = await quotePOST(jsonPost('/api/staff/auto/quote', { bookingId: BOOKING_ID }));

    expect(response.status).toBe(409);
    const body = (await response.json()) as Record<string, unknown>;
    expectC1(body, 'QUOTE_FAILED');
    expect(body).not.toHaveProperty('details');
  });
});

describe('ops read routes: validation codes', () => {
  it('heatmap rejects oversized windows with VALIDATION_FAILED', async () => {
    const response = await dashboardHeatmapGET(
      new NextRequest(
        `${ORIGIN}/api/ops/dashboard/heatmap?restaurantId=${RESTAURANT_ID}&startDate=2026-01-01&endDate=2026-12-31`,
      ),
    );

    expect(response.status).toBe(400);
    expectC1((await response.json()) as Record<string, unknown>, 'VALIDATION_FAILED');
    expect(mocks.getBookingsHeatmap).not.toHaveBeenCalled();
  });

  it('changes rejects an out-of-range limit with a limit field message', async () => {
    const response = await dashboardChangesGET(
      new NextRequest(
        `${ORIGIN}/api/ops/dashboard/changes?restaurantId=${RESTAURANT_ID}&limit=100000`,
      ),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expectC1(body, 'VALIDATION_FAILED');
    expect(body.fields).toHaveProperty('limit');
  });

  it('customers returns field messages for an invalid query instead of a flattened zod dump', async () => {
    const response = await customersGET(
      new NextRequest(`${ORIGIN}/api/ops/customers?pageSize=999`),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expectC1(body, 'VALIDATION_FAILED');
    expect(body.fields).toHaveProperty('pageSize');
    expect(body).not.toHaveProperty('details');
  });

  it('history returns 400 BOOKING_ID_REQUIRED without an id', async () => {
    const response = await historyGET(new NextRequest(`${ORIGIN}/api/ops/bookings/x/history`), {
      params: Promise.resolve({ id: [] }),
    });

    expect(response.status).toBe(400);
    expectC1((await response.json()) as Record<string, unknown>, 'BOOKING_ID_REQUIRED');
  });

  it('bookings export returns 403 FORBIDDEN when membership validation fails', async () => {
    mocks.requireMembershipForRestaurant.mockRejectedValue(new Error(SECRET));

    const response = await bookingsExportGET(
      new NextRequest(`${ORIGIN}/api/ops/bookings/export?restaurantId=${RESTAURANT_ID}`),
    );

    expect(response.status).toBe(403);
    const body = await expectNoLeak(response);
    expectC1(body, 'FORBIDDEN');
    expect(mocks.getTodayBookingsSummary).not.toHaveBeenCalled();
  });
});
