import { describe, expect, it, vi } from 'vitest';

import {
  getBookingTableAssignments,
  unassignTableFromBooking,
} from '@/server/capacity/table-assignment/assignment';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const TABLE_ID = '22222222-2222-4222-8222-222222222222';

describe('table assignment unassign helpers', () => {
  it('surfaces atomic unassign RPC errors instead of returning false', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'deadlock detected',
          code: '40P01',
          details: null,
          hint: null,
        },
      }),
    };

    await expect(
      unassignTableFromBooking(BOOKING_ID, TABLE_ID, client as never),
    ).rejects.toMatchObject({
      message: 'Failed to unassign table: deadlock detected',
      code: '40P01',
    });
  });

  it('surfaces assignment reload errors instead of returning an empty list', async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(async () => ({
        data: null,
        error: {
          message: 'read failed',
          code: 'READ_FAILED',
          details: null,
          hint: null,
        },
      })),
    };
    const client = {
      from: vi.fn(() => chain),
    };

    await expect(getBookingTableAssignments(BOOKING_ID, client as never)).rejects.toMatchObject({
      message: 'Failed to load booking table assignments: read failed',
      code: 'READ_FAILED',
    });
  });
});
