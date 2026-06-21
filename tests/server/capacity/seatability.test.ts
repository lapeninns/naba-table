import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('checkRequestSeatability', () => {
  beforeEach(() => {
    policyState.combinationEnabled = true;
    loadRestaurantTimezoneMock.mockReset();
    loadRestaurantTimezoneMock.mockResolvedValue('Europe/London');
    loadTablesForRestaurantMock.mockReset();
    loadAdjacencyMock.mockReset();
    loadContextBookingsMock.mockReset();
    loadContextBookingsMock.mockResolvedValue([]);
    loadActiveHoldsForDateMock.mockReset();
    loadActiveHoldsForDateMock.mockResolvedValue([]);
    getRestaurantTurnBandsMock.mockReset();
    getRestaurantTurnBandsMock.mockResolvedValue({});
  });

  it('rejects aggregate capacity that cannot form a real seating plan', async () => {
    const fixedTwoTops = [
      createTable({ id: 'table-1', tableNumber: '01', capacity: 2, mobility: 'fixed' }),
      createTable({ id: 'table-2', tableNumber: '02', capacity: 2, mobility: 'fixed' }),
    ];

    loadTablesForRestaurantMock.mockResolvedValue(fixedTwoTops);
    loadAdjacencyMock.mockResolvedValue(
      new Map<string, Set<string>>([
        ['table-1', new Set(['table-2'])],
        ['table-2', new Set(['table-1'])],
      ]),
    );

    const result = await checkRequestSeatability({
      restaurantId: 'restaurant-1',
      date: '2026-04-18',
      time: '19:00',
      partySize: 4,
      bookingOption: 'dinner',
    });

    expect(result.seatable).toBe(false);
    expect(result.reason).toBe('No tables available for requested window');
    expect(result.metadata.totalTables).toBe(2);
    expect(result.metadata.filteredTables).toBe(0);
  });

  it('accepts a party when the planner can form a valid merged table plan', async () => {
    const movableTwoTops = [
      createTable({ id: 'table-1', tableNumber: '01', capacity: 2, mobility: 'movable' }),
      createTable({ id: 'table-2', tableNumber: '02', capacity: 2, mobility: 'movable' }),
    ];

    loadTablesForRestaurantMock.mockResolvedValue(movableTwoTops);
    loadAdjacencyMock.mockResolvedValue(
      new Map<string, Set<string>>([
        ['table-1', new Set(['table-2'])],
        ['table-2', new Set(['table-1'])],
      ]),
    );

    const result = await checkRequestSeatability({
      restaurantId: 'restaurant-1',
      date: '2026-04-18',
      time: '19:00',
      partySize: 4,
      bookingOption: 'dinner',
    });

    expect(result.seatable).toBe(true);
    expect(result.metadata.generatedPlans).toBeGreaterThan(0);
    expect(result.reason).toBeUndefined();
  });
});
