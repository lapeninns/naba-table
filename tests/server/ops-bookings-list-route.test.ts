import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const select = vi.fn();
  const eq = vi.fn();
  const range = vi.fn();
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: vi.fn((...args: unknown[]) => {
      select(...args);
      return builder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      eq(...args);
      return builder;
    }),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    or: vi.fn(() => builder),
    range: vi.fn((...args: unknown[]) => range(...args)),
  });

  return {
    builder,
    select,
    eq,
    range,
    from: vi.fn(() => builder),
    getUser: vi.fn(),
    fetchUserMemberships: vi.fn(),
    consumeRateLimit: vi.fn(),
    recordObservabilityEvent: vi.fn(),
  };
});

vi.mock('@/lib/env', () => ({
  env: {},
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
  getServiceSupabaseClient: vi.fn(() => ({ from: mocks.from })),
}));

vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: vi.fn(),
  fetchUserMemberships: mocks.fetchUserMemberships,
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}));

vi.mock('@/server/security/request', () => ({
  anonymizeIp: vi.fn((ip: string) => `anon:${ip}`),
  extractClientIp: vi.fn(() => '203.0.113.10'),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: mocks.recordObservabilityEvent,
}));

vi.mock('@/server/booking', () => ({
  createBookingValidationService: vi.fn(),
  BookingValidationError: class BookingValidationError extends Error {
    response = { ok: false, issues: [] };
  },
}));

vi.mock('@/server/bookings', () => ({
  deriveEndTimeFromDuration: vi.fn(),
  fetchBookingsForContact: vi.fn(),
  inferMealTypeFromTime: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock('@/server/bookings/duration', () => ({
  resolveBookingDurationMinutes: vi.fn(),
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn(() => ({ body: { error: 'validation failed' }, status: 422 })),
  withValidationHeaders: vi.fn((options) => options),
}));

vi.mock('@/server/customers', () => ({
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
  upsertCustomer: vi.fn(),
}));

vi.mock('@/server/runtime-policy', () => ({
  isAutoAssignOnBookingEnabled: vi.fn(() => false),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCreatedSideEffects: vi.fn(),
  safeBookingPayload: vi.fn((booking) => booking),
}));

import { GET } from '@/src/app/api/ops/bookings/route';
import {
  appHostRequest,
  expectNoProtectedSideEffects,
  SECURITY_RESTAURANTS,
} from '@/tests/server/security/protected-route-helpers';

const RESTAURANT_ID = SECURITY_RESTAURANTS.primary;
const OTHER_RESTAURANT_ID = SECURITY_RESTAURANTS.other;
const TABLE_ID = '33333333-3333-4333-8333-333333333333';

function makeRequest(search = '') {
  return new NextRequest(`https://app.nabatable.com/api/ops/bookings${search}`);
}

describe('GET /api/ops/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue(mocks.builder);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ops@example.com' } },
      error: null,
    });
    mocks.fetchUserMemberships.mockResolvedValue([{ restaurant_id: RESTAURANT_ID, role: 'owner' }]);
    mocks.consumeRateLimit.mockResolvedValue({
      ok: true,
      limit: 120,
      remaining: 119,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    mocks.range.mockResolvedValue({ data: [], error: null, count: 0 });
  });

  it('rejects unauthenticated requests before membership or service-role reads @p0 @api @security', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(appHostRequest('/api/ops/bookings'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
    expect(mocks.fetchUserMemberships).not.toHaveBeenCalled();
    expectNoProtectedSideEffects({
      serviceFrom: mocks.from,
      bookingsRange: mocks.range,
    });
  });

  it('rejects wrong-restaurant reads before service-role booking queries @p0 @api @security', async () => {
    const response = await GET(
      appHostRequest(`/api/ops/bookings?restaurantId=${OTHER_RESTAURANT_ID}`),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(mocks.fetchUserMemberships).toHaveBeenCalledWith('user-1', expect.anything());
    expectNoProtectedSideEffects({
      serviceFrom: mocks.from,
      bookingsRange: mocks.range,
    });
  });

  it('uses the regular embedded assignments relation when not filtering by table', async () => {
    const response = await GET(makeRequest(`?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(200);
    const selectSql = String(mocks.select.mock.calls[0]?.[0] ?? '');
    expect(selectSql).toContain('booking_table_assignments(');
    expect(selectSql).not.toContain('booking_table_assignments!inner');
  });

  it('uses an inner assignments relation when filtering parent bookings by table', async () => {
    const response = await GET(makeRequest(`?restaurantId=${RESTAURANT_ID}&tableId=${TABLE_ID}`));

    expect(response.status).toBe(200);
    const selectSql = String(mocks.select.mock.calls[0]?.[0] ?? '');
    expect(selectSql).toContain('booking_table_assignments!inner(');
    expect(mocks.eq).toHaveBeenCalledWith('booking_table_assignments.table_id', TABLE_ID);
  });
});
