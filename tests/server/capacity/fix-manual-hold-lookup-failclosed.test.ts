import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/capacity/holds', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/capacity/holds')>()),
  findHoldConflicts: vi.fn(),
  listActiveHoldsForBooking: vi.fn(),
}));

import { findHoldConflicts, listActiveHoldsForBooking } from '@/server/capacity/holds';
import {
  findManualHoldConflicts,
  listManualActiveHoldsForBooking,
} from '@/server/capacity/table-assignment/manual-conflict-context';

import type { BookingWindow } from '@/server/capacity/table-assignment/types';

const window = {
  block: {
    start: DateTime.fromISO('2026-05-23T18:00:00.000Z'),
    end: DateTime.fromISO('2026-05-23T19:30:00.000Z'),
  },
} as BookingWindow;

const client = {} as never;

/**
 * Regression for #1 / #20b: these lookups previously did `catch { return [] }`,
 * so a hold-table failure (mid-migration, permission denied, transient outage)
 * looked exactly like "no conflicts / no active holds" and let a manual
 * assignment proceed onto a still-held table — a silent double-booking. They must
 * now FAIL CLOSED: surface the error so confirmation is blocked.
 */
describe('#1/#20b manual hold lookups fail closed', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('#1 findManualHoldConflicts propagates lookup errors instead of swallowing as []', async () => {
    vi.mocked(findHoldConflicts).mockRejectedValueOnce(new Error('holds table unavailable'));

    await expect(
      findManualHoldConflicts({ client, restaurantId: 'r1', tableIds: ['t1'], window }),
    ).rejects.toThrow('holds table unavailable');
    expect(console.error).toHaveBeenCalled();
  });

  it('#20b listManualActiveHoldsForBooking propagates lookup errors', async () => {
    vi.mocked(listActiveHoldsForBooking).mockRejectedValueOnce(new Error('db down'));

    await expect(
      listManualActiveHoldsForBooking({ bookingId: 'b1', client, enabled: true }),
    ).rejects.toThrow('db down');
    expect(console.error).toHaveBeenCalled();
  });

  it('#20b returns [] when holds are disabled, without attempting a lookup', async () => {
    const result = await listManualActiveHoldsForBooking({ bookingId: 'b1', client, enabled: false });

    expect(result).toEqual([]);
    expect(listActiveHoldsForBooking).not.toHaveBeenCalled();
  });

  it('passes through normally when the lookups succeed', async () => {
    vi.mocked(findHoldConflicts).mockResolvedValueOnce([]);
    vi.mocked(listActiveHoldsForBooking).mockResolvedValueOnce([]);

    await expect(
      findManualHoldConflicts({ client, restaurantId: 'r1', tableIds: ['t1'], window }),
    ).resolves.toEqual([]);
    await expect(
      listManualActiveHoldsForBooking({ bookingId: 'b1', client, enabled: true }),
    ).resolves.toEqual([]);
  });
});
