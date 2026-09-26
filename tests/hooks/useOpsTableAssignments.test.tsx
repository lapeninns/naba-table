import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';


import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { useOpsTableAssignmentActions } from '@src/hooks/ops/useOpsTableAssignments';

import {
  RESTAURANT_ID,
  DATE,
  createFeedbackQueryClient,
  deferred,
  makeListItem,
  makeRow,
  makeSummary,
  summaryKey,
  summaryRow,
} from './__helpers__/opsBookingFixtures';

import type { OpsBookingListItem } from '@/types/ops';

const bookingService = vi.hoisted(() => ({
  assignTable: vi.fn(),
  unassignTable: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({ useBookingService: () => bookingService }));

const t1 = {
  groupId: null,
  capacitySum: 4,
  members: [{ tableId: 't1', tableNumber: 'T1', capacity: 4, section: null }],
};

function setup(rows = [makeRow({ id: 'b1', status: 'pending' }), makeRow({ id: 'b2' })]) {
  const { queryClient, notify } = createFeedbackQueryClient();
  queryClient.setQueryData(summaryKey(), makeSummary(rows));
  queryClient.setQueryData(
    queryKeys.opsBookings.detail('b1'),
    makeListItem({ id: 'b1', status: 'pending' }),
  );
  const hook = renderHook(
    () => useOpsTableAssignmentActions({ restaurantId: RESTAURANT_ID, date: DATE }),
    {
      wrapper: createQueryWrapper(queryClient),
    },
  );
  return { queryClient, notify, ...hook };
}

describe('useOpsTableAssignmentActions', () => {
  it('@contract assigns optimistically with the idempotency key in the variables, then writes the server groups', async () => {
    const request = deferred<unknown>();
    bookingService.assignTable.mockReturnValue(request.promise);
    const { result, queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.assign({
        bookingId: 'b1',
        tableId: 't1',
        tableName: 'T1',
        idempotencyKey: 'intent-1',
      });
    });

    await waitFor(() =>
      expect(summaryRow(queryClient, 'b1')?.tableAssignments[0]?.members[0]?.tableId).toBe('t1'),
    );
    expect(summaryRow(queryClient, 'b1')).toMatchObject({
      status: 'confirmed',
      requiresTableAssignment: false,
    });
    await waitFor(() =>
      expect(result.current.pendingAction).toEqual({
        type: 'assign',
        bookingId: 'b1',
        tableId: 't1',
        tableName: 'T1',
      }),
    );
    expect(bookingService.assignTable).toHaveBeenCalledWith({
      bookingId: 'b1',
      tableId: 't1',
      idempotencyKey: 'intent-1',
    });

    request.resolve({ tableAssignments: [t1] });
    await act(async () => {
      await expect(done).resolves.toEqual([t1]);
    });

    expect(summaryRow(queryClient, 'b1')?.tableAssignments).toEqual([t1]);
    expect(
      queryClient.getQueryData<OpsBookingListItem>(queryKeys.opsBookings.detail('b1'))
        ?.tableAssignments,
    ).toEqual([t1]);
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).not.toContainEqual(queryKeys.opsBookings.all);
    expect(keys).not.toContainEqual(summaryKey());
    await waitFor(() => expect(result.current.pendingAction).toBeNull());
  });

  it('@contract generates one idempotency key per intent when the caller does not pass one', async () => {
    bookingService.assignTable.mockResolvedValue({ tableAssignments: [t1] });
    const { result } = setup();

    await act(async () => {
      await result.current.assign({ bookingId: 'b1', tableId: 't1' });
      await result.current.assign({ bookingId: 'b2', tableId: 't1' });
    });

    const [first, second] = bookingService.assignTable.mock.calls.map(
      ([input]) => input.idempotencyKey,
    );
    expect(first).toEqual(expect.any(String));
    expect(second).toEqual(expect.any(String));
    expect(first).not.toBe(second);
  });

  it('@contract shows assignment errors to the user and rolls back only that booking', async () => {
    bookingService.assignTable.mockRejectedValue(
      new HttpError({ message: 'raw', status: 409, code: 'ASSIGNMENT_CONFLICT' }),
    );
    bookingService.unassignTable.mockResolvedValue({ tableAssignments: [] });
    const { result, queryClient, notify } = setup([
      makeRow({ id: 'b1', status: 'pending' }),
      makeRow({ id: 'b2', tableAssignments: [t1], requiresTableAssignment: false }),
    ]);

    let groups: unknown;
    await act(async () => {
      [groups] = await Promise.all([
        result.current.assign({ bookingId: 'b1', tableId: 't1', tableName: 'T1' }),
        result.current.unassign({ bookingId: 'b2', tableId: 't1' }),
      ]);
    });

    expect(groups).toEqual([]);
    expect(summaryRow(queryClient, 'b1')).toMatchObject({
      status: 'pending',
      tableAssignments: [],
    });
    expect(summaryRow(queryClient, 'b2')).toMatchObject({
      status: 'pending',
      tableAssignments: [],
    });
    expect(notify.error).toHaveBeenCalledWith(
      'That table was just taken by another booking. Pick another table.',
    );
  });

  it('@contract unassigning the last table reopens a confirmed booking', async () => {
    bookingService.unassignTable.mockResolvedValue({ tableAssignments: [] });
    const { result, queryClient } = setup([
      makeRow({
        id: 'b1',
        status: 'confirmed',
        tableAssignments: [t1],
        requiresTableAssignment: false,
      }),
    ]);

    await act(async () => {
      await result.current.unassign({ bookingId: 'b1', tableId: 't1' });
    });

    expect(bookingService.unassignTable).toHaveBeenCalledWith({ bookingId: 'b1', tableId: 't1' });
    expect(summaryRow(queryClient, 'b1')).toMatchObject({
      status: 'pending',
      tableAssignments: [],
      requiresTableAssignment: true,
    });
  });
});
