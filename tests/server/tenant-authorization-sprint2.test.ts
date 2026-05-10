import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const withRestaurantAuthorizationMock = vi.hoisted(() => vi.fn());
const withBookingAuthorizationMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const getTenantServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const updateOperatingHoursMock = vi.hoisted(() => vi.fn());
const updateServicePeriodsMock = vi.hoisted(() => vi.fn());
const createZoneMock = vi.hoisted(() => vi.fn());
const insertTableMock = vi.hoisted(() => vi.fn());
const cleanupOrphanedAssignmentsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/server/auth/guards');
  return {
    ...actual,
    withRestaurantAuthorization: withRestaurantAuthorizationMock,
    withBookingAuthorization: withBookingAuthorizationMock,
  };
});

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
  getTenantServiceSupabaseClient: getTenantServiceSupabaseClientMock,
}));

vi.mock('@/server/restaurants/operatingHours', () => ({
  updateOperatingHours: updateOperatingHoursMock,
}));

vi.mock('@/server/restaurants/servicePeriods', () => ({
  updateServicePeriods: updateServicePeriodsMock,
}));

vi.mock('@/server/ops/zones', () => ({
  createZone: createZoneMock,
}));

vi.mock('@/server/ops/tables', () => ({
  insertTable: insertTableMock,
}));

vi.mock('@/server/capacity/table-assignment/direct-assignment', () => ({
  cleanupOrphanedAssignments: cleanupOrphanedAssignmentsMock,
}));

import { POST as onboardingCompletePOST } from '@/src/app/api/onboarding/restaurant/[id]/complete/route';
import { PATCH as onboardingHoursPATCH } from '@/src/app/api/onboarding/restaurant/[id]/hours/route';
import { PATCH as onboardingServicePeriodsPATCH } from '@/src/app/api/onboarding/restaurant/[id]/service-periods/route';
import { POST as onboardingTablesPOST } from '@/src/app/api/onboarding/restaurant/[id]/tables/route';
import { POST as onboardingZonesPOST } from '@/src/app/api/onboarding/restaurant/[id]/zones/route';
import { GET as assignmentContextGET } from '@/src/app/api/ops/bookings/[id]/assignment-context/route';

const RESTAURANT_A = '6f4ddf92-6c8b-4ed2-a419-f8af95d7c111';
const RESTAURANT_B = '8d403656-86b8-43ea-b7e4-39e85423dfb2';
const BOOKING_ID = 'ba760d72-617b-4fa7-bab2-9b198d398ef0';
const ZONE_A = '13ccb0f4-dbb2-4878-80dc-21e9a5b93275';
const ZONE_B = '99d546a0-88bd-4c7a-9868-4717bf64dfcc';

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(path: string, body: unknown, method = 'POST') {
  return new NextRequest(`https://app.nabatable.com${path}`, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function forbiddenAuthorization() {
  return {
    ok: false,
    response: Response.json({ error: 'Forbidden' }, { status: 403 }),
  };
}

function authorizedRestaurant() {
  return {
    ok: true,
    restaurantId: RESTAURANT_A,
    user: { id: 'user-a' },
    membership: { role: 'owner', restaurant_id: RESTAURANT_A },
    supabase: {
      from: vi.fn((table: string) => {
        if (table !== 'zones') {
          throw new Error(`Unexpected table: ${table}`);
        }
        const chain = {
          select: vi.fn(() => chain),
          in: vi.fn(async () => ({
            data: [{ id: ZONE_A, restaurant_id: RESTAURANT_A }],
            error: null,
          })),
        };
        return chain;
      }),
    },
  };
}

function buildAssignmentServiceClient(
  options: {
    booking?: Partial<{
      start_at: string;
      booking_date: string;
      start_time: string;
      party_size: number;
      booking_type: string | null;
    }>;
  } = {},
) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  const tableResult = {
    data: [
      {
        id: 'table-1',
        table_number: '1',
        name: null,
        capacity: 4,
        min_party_size: 1,
        max_party_size: 4,
        section: null,
        category: 'dining',
        seating_type: 'standard',
        mobility: 'fixed',
        zone_id: ZONE_A,
        zone: { active: true },
        status: 'available',
        active: true,
        position: null,
      },
    ],
    error: null,
  };
  const contextBookingsResult = { data: [], error: null };
  const assignmentsResult = { data: [], error: null };

  function builder(table: string) {
    const chain = {
      select: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'select', args });
        return chain;
      }),
      eq: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'eq', args });
        return chain;
      }),
      order: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'order', args });
        return Promise.resolve(tableResult);
      }),
      or: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'or', args });
        return Promise.resolve(contextBookingsResult);
      }),
      single: vi.fn(async () => ({
        data: {
          id: BOOKING_ID,
          restaurant_id: RESTAURANT_A,
          start_at: '2026-05-05T18:00:00.000Z',
          booking_date: '2026-05-05',
          start_time: '18:00',
          party_size: 2,
          status: 'confirmed',
          booking_type: null,
          restaurants: { timezone: 'Europe/London' },
          ...options.booking,
        },
        error: null,
      })),
    };

    if (table === 'bookings') {
      chain.eq = vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'eq', args });
        return chain;
      });
    }

    if (table === 'booking_table_assignments') {
      chain.eq = vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'eq', args });
        return Promise.resolve(assignmentsResult) as never;
      });
    }

    return chain;
  }

  return {
    client: { from: vi.fn((table: string) => builder(table)) },
    calls,
  };
}

describe('Sprint 2 tenant authorization route containment', () => {
  beforeEach(() => {
    withRestaurantAuthorizationMock.mockReset();
    withBookingAuthorizationMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    getTenantServiceSupabaseClientMock.mockReset();
    updateOperatingHoursMock.mockReset();
    updateServicePeriodsMock.mockReset();
    createZoneMock.mockReset();
    insertTableMock.mockReset();
    cleanupOrphanedAssignmentsMock.mockReset();
  });

  it.each([
    ['hours', onboardingHoursPATCH, { operatingHours: [] }, 'PATCH'],
    ['service-periods', onboardingServicePeriodsPATCH, { servicePeriods: [] }, 'PATCH'],
    ['zones', onboardingZonesPOST, { zones: [{ name: 'Dining' }] }, 'POST'],
    [
      'tables',
      onboardingTablesPOST,
      { tables: [{ tableNumber: '1', capacity: 2, zoneId: ZONE_A }] },
      'POST',
    ],
    ['complete', onboardingCompletePOST, {}, 'POST'],
  ])(
    'does not construct a service client when onboarding %s authorization fails',
    async (_name, handler, body, method) => {
      withRestaurantAuthorizationMock.mockResolvedValue(forbiddenAuthorization());

      const response = await handler(
        jsonRequest(`/api/onboarding/restaurant/${RESTAURANT_B}/${_name}`, body, method),
        routeContext(RESTAURANT_B),
      );

      expect(response.status).toBe(403);
      expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
      expect(updateOperatingHoursMock).not.toHaveBeenCalled();
      expect(updateServicePeriodsMock).not.toHaveBeenCalled();
      expect(createZoneMock).not.toHaveBeenCalled();
      expect(insertTableMock).not.toHaveBeenCalled();
    },
  );

  it('rejects onboarding tables when a zone id belongs to another restaurant', async () => {
    const authorization = authorizedRestaurant();
    authorization.supabase.from = vi.fn(() => {
      const chain = {
        select: vi.fn(() => chain),
        in: vi.fn(async () => ({
          data: [
            { id: ZONE_A, restaurant_id: RESTAURANT_A },
            { id: ZONE_B, restaurant_id: RESTAURANT_B },
          ],
          error: null,
        })),
      };
      return chain;
    });
    withRestaurantAuthorizationMock.mockResolvedValue(authorization);
    getServiceSupabaseClientMock.mockReturnValue({ from: vi.fn() });

    const response = await onboardingTablesPOST(
      jsonRequest(`/api/onboarding/restaurant/${RESTAURANT_A}/tables`, {
        tables: [
          { tableNumber: '1', capacity: 2, zoneId: ZONE_A },
          { tableNumber: '2', capacity: 2, zoneId: ZONE_B },
        ],
      }),
      routeContext(RESTAURANT_A),
    );

    expect(response.status).toBe(400);
    expect(insertTableMock).not.toHaveBeenCalled();
  });

  it('does not construct assignment-context service clients when booking authorization fails', async () => {
    withBookingAuthorizationMock.mockResolvedValue(forbiddenAuthorization());

    const response = await assignmentContextGET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/bookings/${BOOKING_ID}/assignment-context`,
      ),
      routeContext(BOOKING_ID),
    );

    expect(response.status).toBe(403);
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(getTenantServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('scopes assignment-context same-day booking reads to the authorized restaurant', async () => {
    withBookingAuthorizationMock.mockResolvedValue({
      ok: true,
      bookingId: BOOKING_ID,
      restaurantId: RESTAURANT_A,
      user: { id: 'user-a' },
      membership: { role: 'host', restaurant_id: RESTAURANT_A },
      supabase: {},
    });
    const service = buildAssignmentServiceClient();
    getServiceSupabaseClientMock.mockReturnValue(service.client);
    getTenantServiceSupabaseClientMock.mockReturnValue(service.client);

    const response = await assignmentContextGET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/bookings/${BOOKING_ID}/assignment-context`,
      ),
      routeContext(BOOKING_ID),
    );

    expect(response.status).toBe(200);
    expect(service.calls).toContainEqual({
      table: 'bookings',
      method: 'eq',
      args: ['restaurant_id', RESTAURANT_A],
    });
    expect(service.calls.some((call) => call.table === 'bookings' && call.method === 'or')).toBe(
      true,
    );
    expect(cleanupOrphanedAssignmentsMock).not.toHaveBeenCalled();
  });

  it('uses booking_type when assignment-context has to fall back outside service windows', async () => {
    withBookingAuthorizationMock.mockResolvedValue({
      ok: true,
      bookingId: BOOKING_ID,
      restaurantId: RESTAURANT_A,
      user: { id: 'user-a' },
      membership: { role: 'host', restaurant_id: RESTAURANT_A },
      supabase: {},
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = buildAssignmentServiceClient({
      booking: {
        start_at: '2026-05-05T14:00:00.000Z',
        booking_date: '2026-05-05',
        start_time: '15:00',
        party_size: 8,
        booking_type: 'dinner',
      },
    });
    getServiceSupabaseClientMock.mockReturnValue(service.client);
    getTenantServiceSupabaseClientMock.mockReturnValue(service.client);

    const response = await assignmentContextGET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/bookings/${BOOKING_ID}/assignment-context`,
      ),
      routeContext(BOOKING_ID),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.window.endAt).toBe('2026-05-05T15:30:00');
    expect(warnSpy).toHaveBeenCalledWith(
      '[capacity][window][fallback] service not found, using fallback service',
      expect.objectContaining({ fallbackService: 'dinner' }),
    );

    warnSpy.mockRestore();
  });
});
