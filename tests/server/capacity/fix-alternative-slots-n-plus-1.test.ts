import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression for #5 (N+1 in findAlternativeSlots): the real per-candidate cost is
 * the restaurant/date-constant loads inside checkRequestSeatability — timezone,
 * turn bands, and active holds — which were re-issued for every candidate slot.
 * The fix lets a caller preload them ONCE and pass them in. This test asserts the
 * preloaded path actually SKIPS those loads (old code ignored the param and would
 * still call them, so this fails on old / passes on new).
 */
const loaders = vi.hoisted(() => ({
  loadRestaurantTimezone: vi.fn(async () => 'UTC'),
  getRestaurantTurnBands: vi.fn(async () => ({})),
  loadActiveHoldsForDate: vi.fn(async () => []),
  loadTablesForRestaurant: vi.fn(async () => [
    {
      id: 'table-1',
      tableNumber: '01',
      capacity: 4,
      zoneId: 'zone-1',
      status: 'available',
      active: true,
      zoneActive: true,
      mobility: 'movable',
      category: null,
      seatingType: null,
      section: null,
      position: null,
      minPartySize: null,
      maxPartySize: null,
    },
  ]),
  loadAdjacency: vi.fn(async () => new Map<string, Set<string>>()),
  loadContextBookings: vi.fn(async () => []),
}));

vi.mock('@/server/capacity/table-assignment/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/capacity/table-assignment/supabase')>()),
  ensureClient: (client: unknown) => client ?? {},
  loadRestaurantTimezone: loaders.loadRestaurantTimezone,
  loadActiveHoldsForDate: loaders.loadActiveHoldsForDate,
  loadTablesForRestaurant: loaders.loadTablesForRestaurant,
  loadAdjacency: loaders.loadAdjacency,
  loadContextBookings: loaders.loadContextBookings,
}));

vi.mock('@/server/restaurants/turnBands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/restaurants/turnBands')>()),
  getRestaurantTurnBands: loaders.getRestaurantTurnBands,
}));

vi.mock('@/server/runtime-policy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/runtime-policy')>()),
  isHoldsEnabled: () => true,
}));

import { checkRequestSeatability } from '@/server/capacity/seatability';

const params = {
  restaurantId: 'r1',
  date: '2026-05-23',
  time: '18:00',
  partySize: 2,
  bookingOption: 'dinner' as const,
};

describe('#5 checkRequestSeatability preloaded context avoids redundant per-call loads', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads timezone, turn bands, and active holds itself when no preloaded context is given', async () => {
    await checkRequestSeatability(params, {} as never).catch(() => undefined);

    expect(loaders.loadRestaurantTimezone).toHaveBeenCalledTimes(1);
    expect(loaders.getRestaurantTurnBands).toHaveBeenCalledTimes(1);
    expect(loaders.loadActiveHoldsForDate).toHaveBeenCalledTimes(1);
    expect(loaders.loadTablesForRestaurant).toHaveBeenCalled();
    expect(loaders.loadAdjacency).toHaveBeenCalled();
  });

  it('SKIPS all restaurant/date-constant loads when a preloaded context is provided (the N+1 fix)', async () => {
    await checkRequestSeatability(params, {} as never, {
      restaurantTimezone: 'UTC',
      turnBandsByOption: {},
      holdsForDay: [],
      tables: [
        {
          id: 'table-1',
          tableNumber: '01',
          capacity: 4,
          zoneId: 'zone-1',
          status: 'available',
          active: true,
          zoneActive: true,
          mobility: 'movable',
          category: null,
          seatingType: null,
          section: null,
          position: null,
          minPartySize: null,
          maxPartySize: null,
        },
      ],
      adjacency: new Map<string, Set<string>>(),
    }).catch(() => undefined);

    expect(loaders.loadRestaurantTimezone).not.toHaveBeenCalled();
    expect(loaders.getRestaurantTurnBands).not.toHaveBeenCalled();
    expect(loaders.loadActiveHoldsForDate).not.toHaveBeenCalled();
    expect(loaders.loadTablesForRestaurant).not.toHaveBeenCalled();
    expect(loaders.loadAdjacency).not.toHaveBeenCalled();
  });
});
