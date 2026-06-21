import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// GAP #9: checkRequestSeatability loaded the venue timezone via
// `loadRestaurantTimezone(...).catch(() => null)`. On a THROWN load/query error the
// null silently flowed into getVenuePolicy, which defaults to Europe/London — so a
// Sydney venue was evaluated ~10-11h off and availability was computed in the WRONG
// timezone instead of failing. The fix FAILS CLOSED on a thrown error (logs +
// rethrows) while still allowing a legitimately-absent timezone (resolved null) to
// fall back to the default. NOTE: we intentionally do NOT mock '@/server/capacity/policy'
// so the real getVenuePolicy / Europe/London default is exercised.

const policyState = vi.hoisted(() => ({
  combinationEnabled: true,
}));

const loadRestaurantTimezoneMock = vi.hoisted(() => vi.fn());
const loadTablesForRestaurantMock = vi.hoisted(() => vi.fn());
const loadAdjacencyMock = vi.hoisted(() => vi.fn());
const loadContextBookingsMock = vi.hoisted(() => vi.fn());
const loadActiveHoldsForDateMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/runtime-policy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/runtime-policy')>();
  return {
    ...actual,
    isCombinationPlannerEnabled: vi.fn(() => policyState.combinationEnabled),
    getAllocatorKMax: vi.fn(() => 3),
    getSelectorPlannerLimits: vi.fn(() => ({})),
    isHoldsEnabled: vi.fn(() => false),
    isPlannerTimePruningEnabled: vi.fn(() => false),
  };
});

vi.mock('@/server/restaurants/turnBands', () => ({
  getRestaurantTurnBands: getRestaurantTurnBandsMock,
}));

vi.mock('@/server/capacity/table-assignment/supabase', () => ({
  ensureClient: vi.fn((client?: unknown) => client ?? {}),
  loadRestaurantTimezone: loadRestaurantTimezoneMock,
  loadTablesForRestaurant: loadTablesForRestaurantMock,
  loadAdjacency: loadAdjacencyMock,
  loadContextBookings: loadContextBookingsMock,
  loadActiveHoldsForDate: loadActiveHoldsForDateMock,
}));

import { checkRequestSeatability } from '@/server/capacity/seatability';

import type { Table } from '@/server/capacity/table-assignment/types';

function createTable(params: {
  id: string;
  tableNumber: string;
  capacity: number;
  mobility: 'fixed' | 'movable';
}): Table {
  return {
    id: params.id,
    tableNumber: params.tableNumber,
    capacity: params.capacity,
    mobility: params.mobility,
    zoneId: 'zone-1',
    zoneActive: true,
    active: true,
    status: 'available',
  };
}

describe('checkRequestSeatability timezone load fail-closed (regression #9)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    policyState.combinationEnabled = true;
    loadRestaurantTimezoneMock.mockReset();
    loadTablesForRestaurantMock.mockReset();
    // A single movable table comfortably seats the party, so a successful run would
    // return seatable=true. This isolates the failure to the timezone load path.
    loadTablesForRestaurantMock.mockResolvedValue([
      createTable({ id: 'table-1', tableNumber: '01', capacity: 4, mobility: 'movable' }),
    ]);
    loadAdjacencyMock.mockReset();
    loadAdjacencyMock.mockResolvedValue(new Map<string, Set<string>>());
    loadContextBookingsMock.mockReset();
    loadContextBookingsMock.mockResolvedValue([]);
    loadActiveHoldsForDateMock.mockReset();
    loadActiveHoldsForDateMock.mockResolvedValue([]);
    getRestaurantTurnBandsMock.mockReset();
    getRestaurantTurnBandsMock.mockResolvedValue({});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('rejects instead of computing Europe/London availability when the timezone load throws', async () => {
    // Sydney venue: a transient DB/query error must NOT silently degrade to the
    // Europe/London default and return availability ~10-11h off.
    loadRestaurantTimezoneMock.mockRejectedValue(new Error('restaurant_settings query failed'));

    await expect(
      checkRequestSeatability({
        restaurantId: 'restaurant-sydney',
        date: '2026-04-18',
        time: '19:00',
        partySize: 2,
        bookingOption: 'dinner',
      }),
    ).rejects.toThrow('restaurant_settings query failed');

    // And the failure is logged with the capacity.seatability prefix (fail-loud).
    expect(errorSpy).toHaveBeenCalled();
    const loggedPrefix = errorSpy.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].startsWith('[capacity.seatability]'),
    );
    expect(loggedPrefix).toBe(true);
  });

  it('still falls back to the default timezone when the loader resolves null (no error)', async () => {
    // A legitimately-absent timezone must keep working exactly as today.
    loadRestaurantTimezoneMock.mockResolvedValue(null);

    const result = await checkRequestSeatability({
      restaurantId: 'restaurant-1',
      date: '2026-04-18',
      time: '19:00',
      partySize: 2,
      bookingOption: 'dinner',
    });

    expect(result.seatable).toBe(true);
    expect(result.metadata.generatedPlans).toBeGreaterThan(0);
    // A resolved null must NOT trip the fail-closed error path.
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
