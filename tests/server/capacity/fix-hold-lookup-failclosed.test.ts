import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force the underlying hold lookups to throw so we can verify the manual-conflict
// context wrappers FAIL CLOSED (propagate) instead of swallowing the error and
// reporting "no holds / no conflicts", which would risk a double-booking.
const findHoldConflicts = vi.fn();
const listActiveHoldsForBooking = vi.fn();

vi.mock('@/server/capacity/holds', () => ({
  findHoldConflicts: (...args: unknown[]) => findHoldConflicts(...args),
  listActiveHoldsForBooking: (...args: unknown[]) => listActiveHoldsForBooking(...args),
}));

import {
  findManualHoldConflicts,
  listManualActiveHoldsForBooking,
} from '@/server/capacity/table-assignment/manual-conflict-context';
import { buildManualChecks } from '@/server/capacity/table-assignment/manual-checks';
import { summarizeSelection } from '@/server/capacity/table-assignment/utils';

import type {
  ManualSelectionCheck,
  Table,
  BookingWindow,
} from '@/server/capacity/table-assignment/types';

const window = {
  block: {
    start: DateTime.fromISO('2026-05-23T18:00:00.000Z'),
    end: DateTime.fromISO('2026-05-23T19:30:00.000Z'),
  },
} as BookingWindow;

function makeTable(overrides: Partial<Table> & { id: string }): Table {
  return {
    id: overrides.id,
    tableNumber: overrides.tableNumber ?? overrides.id,
    capacity: overrides.capacity ?? 2,
    zoneId: overrides.zoneId ?? 'zone-1',
    active: overrides.active ?? true,
    mobility: overrides.mobility ?? 'movable',
    status: overrides.status ?? 'available',
    zoneActive: overrides.zoneActive ?? true,
  };
}

function getCheck(checks: ManualSelectionCheck[], id: ManualSelectionCheck['id']) {
  const check = checks.find((candidate) => candidate.id === id);
  expect(check).toBeDefined();
  return check!;
}

describe('manual hold lookup fail-closed (regression)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    findHoldConflicts.mockReset();
    listActiveHoldsForBooking.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('#1 findManualHoldConflicts propagates lookup errors instead of returning []', async () => {
    findHoldConflicts.mockRejectedValueOnce(new Error('hold_window query failed'));

    await expect(
      findManualHoldConflicts({
        client: {} as never,
        restaurantId: 'restaurant-1',
        tableIds: ['table-1'],
        window,
      }),
    ).rejects.toThrow('hold_window query failed');

    expect(errorSpy).toHaveBeenCalled();
  });

  it('#20b listManualActiveHoldsForBooking propagates lookup errors instead of returning []', async () => {
    listActiveHoldsForBooking.mockRejectedValueOnce(new Error('table_holds query failed'));

    await expect(
      listManualActiveHoldsForBooking({
        bookingId: 'booking-1',
        client: {} as never,
        enabled: true,
      }),
    ).rejects.toThrow('table_holds query failed');

    expect(errorSpy).toHaveBeenCalled();
  });

  it('#20b listManualActiveHoldsForBooking still short-circuits to [] when disabled', async () => {
    await expect(
      listManualActiveHoldsForBooking({
        bookingId: 'booking-1',
        client: {} as never,
        enabled: false,
      }),
    ).resolves.toEqual([]);

    expect(listActiveHoldsForBooking).not.toHaveBeenCalled();
  });

  it('#1 buildManualChecks blocks conflict + holds with a clear reason when hold lookup failed', () => {
    const tables = [makeTable({ id: 'table-1', capacity: 4 })];
    const checks = buildManualChecks({
      adjacency: new Map(),
      conflicts: [],
      holdConflicts: [],
      requireAdjacency: false,
      slackBudget: 4,
      summary: summarizeSelection(tables, 2),
      tables,
      holdLookupOk: false,
    });

    expect(getCheck(checks, 'conflict')).toMatchObject({
      status: 'error',
      message: 'Unable to verify conflicting assignments (hold lookup failed)',
    });
    expect(getCheck(checks, 'holds')).toMatchObject({
      status: 'error',
      message: 'Unable to verify table holds (hold lookup failed)',
    });
    // A failed lookup must NOT pass overall.
    expect(checks.every((check) => check.status !== 'error')).toBe(false);
  });

  it('#1 buildManualChecks keeps conflict + holds ok when lookup succeeded and is empty', () => {
    const tables = [makeTable({ id: 'table-1', capacity: 4 })];
    const checks = buildManualChecks({
      adjacency: new Map(),
      conflicts: [],
      holdConflicts: [],
      requireAdjacency: false,
      slackBudget: 4,
      summary: summarizeSelection(tables, 2),
      tables,
      // holdLookupOk omitted -> defaults to true, preserving existing callers.
    });

    expect(getCheck(checks, 'conflict').status).toBe('ok');
    expect(getCheck(checks, 'holds').status).toBe('ok');
  });
});
