import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import {
  FloorPlanAssignmentError,
  nextStatusAfter,
  useOpsFloorPlanAssignments,
} from '@src/hooks/ops/useOpsFloorPlanAssignments';

import type { ListTablesResult } from '@/services/ops/tables';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const bookingService = vi.hoisted(() => ({
  assignTablesDirect: vi.fn(),
  unassignTablesDirect: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

const restaurantId = 'rest-1';
const date = '2026-09-25';
const summaryKey = queryKeys.opsDashboard.summary(restaurantId, date);
const timelineKey = queryKeys.opsTables.timeline(restaurantId, { date });

function member(tableId: string) {
  return {
    groupId: null,
    capacitySum: 4,
    members: [{ tableId, tableNumber: tableId, capacity: 4, section: null }],
  };
}

function makeBooking(
  id: string,
  status: OpsTodayBooking['status'],
  tableIds: string[],
): OpsTodayBooking {
  return {
    id,
    status,
    partySize: 4,
    customerName: id,
    tableAssignments: tableIds.map(member),
    requiresTableAssignment: tableIds.length === 0,
    checkedInAt: null,
    checkedOutAt: null,
  } as unknown as OpsTodayBooking;
}

function makeSummary(bookings: OpsTodayBooking[]): OpsTodayBookingsSummary {
  return {
    restaurantId,
    date,
    timezone: 'Europe/London',
    bookings,
    totals: {},
  } as unknown as OpsTodayBookingsSummary;
}

function tableIdsOf(queryClient: ReturnType<typeof createTestQueryClient>, bookingId: string) {
  const summary = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey);
  const booking = summary?.bookings.find((b) => b.id === bookingId);
  return {
    status: booking?.status,
    tableIds: booking?.tableAssignments.flatMap((g) => g.members.map((m) => m.tableId)),
    requiresTableAssignment: booking?.requiresTableAssignment,
  };
}

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(bookings: OpsTodayBooking[]) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(summaryKey, makeSummary(bookings));
  queryClient.setQueryData(timelineKey, { tables: [] });
  queryClient.setQueryData<ListTablesResult>(queryKeys.opsTables.list(restaurantId), {
    tables: [
      { id: 'T3', tableNumber: 'T3', capacity: 4, section: 'Main' },
      { id: 'T4', tableNumber: 'T4', capacity: 4, section: 'Main' },
    ],
    summary: null,
  } as unknown as ListTablesResult);
  const wrapper = createQueryWrapper(queryClient);
  const hook = renderHook(() => useOpsFloorPlanAssignments({ restaurantId, date }), { wrapper });
  return { queryClient, hook };
}

beforeEach(() => {
  bookingService.assignTablesDirect.mockReset();
  bookingService.unassignTablesDirect.mockReset();
});

describe('nextStatusAfter', () => {
  it('mirrors the server status rules', () => {
    expect(nextStatusAfter('pending_allocation', 'assign', 1)).toBe('confirmed');
    expect(nextStatusAfter('confirmed', 'unassign', 0)).toBe('pending');
    expect(nextStatusAfter('checked_in', 'unassign', 0)).toBe('checked_in');
    expect(nextStatusAfter('confirmed', 'move', 2)).toBe('confirmed');
  });
});

describe('useOpsFloorPlanAssignments', () => {
  it('assigns optimistically, exposes the pending change, then refetches once settled', async () => {
    const request = deferred();
    bookingService.assignTablesDirect.mockReturnValue(request.promise);
    const { queryClient, hook } = setup([makeBooking('b1', 'pending_allocation', [])]);

    let done!: Promise<void>;
    act(() => {
      done = hook.result.current.assign('b1', ['T3', 'T4']);
    });

    await waitFor(() => expect(tableIdsOf(queryClient, 'b1').tableIds).toEqual(['T3', 'T4']));
    expect(tableIdsOf(queryClient, 'b1')).toMatchObject({
      status: 'confirmed',
      requiresTableAssignment: false,
    });
    await waitFor(() =>
      expect(hook.result.current.pending).toEqual([
        { bookingId: 'b1', kind: 'assign', tableIds: ['T3', 'T4'], previousTableIds: [] },
      ]),
    );
    expect(bookingService.assignTablesDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'b1',
        tableIds: ['T3', 'T4'],
        idempotencyKey: expect.any(String),
      }),
    );

    await act(async () => {
      request.resolve({ success: true });
      await done;
    });
    expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(timelineKey)?.isInvalidated).toBe(true);
    await waitFor(() => expect(hook.result.current.pending).toEqual([]));
  });

  it('rolls back only the failed booking and maps conflicts to a safe message', async () => {
    const failing = deferred();
    const succeeding = deferred();
    bookingService.assignTablesDirect.mockImplementation(({ bookingId }: { bookingId: string }) =>
      bookingId === 'b1' ? failing.promise : succeeding.promise,
    );
    const { queryClient, hook } = setup([
      makeBooking('b1', 'pending_allocation', []),
      makeBooking('b2', 'pending_allocation', []),
    ]);

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = hook.result.current.assign('b1', ['T3']);
      second = hook.result.current.assign('b2', ['T4']);
    });
    await waitFor(() => expect(tableIdsOf(queryClient, 'b2').tableIds).toEqual(['T4']));

    let caught: unknown;
    await act(async () => {
      failing.reject(
        new HttpError({ message: 'raw db detail', status: 409, code: 'ASSIGNMENT_CONFLICT' }),
      );
      caught = await first.catch((error: unknown) => error);
    });
    expect(caught).toBeInstanceOf(FloorPlanAssignmentError);
    expect(caught).toMatchObject({
      code: 'CONFLICT',
      message: expect.not.stringContaining('raw db'),
    });
    expect(tableIdsOf(queryClient, 'b1')).toMatchObject({
      tableIds: [],
      status: 'pending_allocation',
    });
    // The other in-flight change is untouched, and nothing refetches yet.
    expect(tableIdsOf(queryClient, 'b2').tableIds).toEqual(['T4']);
    expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(false);

    await act(async () => {
      succeeding.resolve({ success: true });
      await second;
    });
    expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
  });

  it('moves by releasing the old tables then assigning the new ones', async () => {
    bookingService.unassignTablesDirect.mockResolvedValue({ success: true, removedCount: 1 });
    bookingService.assignTablesDirect.mockResolvedValue({ success: true });
    const { queryClient, hook } = setup([makeBooking('b1', 'confirmed', ['T3'])]);

    await act(async () => {
      await hook.result.current.move('b1', ['T3'], ['T4']);
    });

    expect(bookingService.unassignTablesDirect).toHaveBeenCalledWith({
      bookingId: 'b1',
      tableIds: ['T3'],
    });
    expect(bookingService.assignTablesDirect).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'b1', tableIds: ['T4'] }),
    );
    expect(bookingService.unassignTablesDirect.mock.invocationCallOrder[0]).toBeLessThan(
      bookingService.assignTablesDirect.mock.invocationCallOrder[0]!,
    );
    expect(tableIdsOf(queryClient, 'b1')).toMatchObject({ tableIds: ['T4'], status: 'confirmed' });
  });

  it('only touches the tables that change when a joined booking moves', async () => {
    bookingService.unassignTablesDirect.mockResolvedValue({ success: true, removedCount: 1 });
    bookingService.assignTablesDirect.mockResolvedValue({ success: true });
    const { hook } = setup([makeBooking('b1', 'checked_in', ['T3', 'T4'])]);

    await act(async () => {
      await hook.result.current.move('b1', ['T3', 'T4'], ['T3', 'T5']);
    });

    expect(bookingService.unassignTablesDirect).toHaveBeenCalledWith({
      bookingId: 'b1',
      tableIds: ['T4'],
    });
    expect(bookingService.assignTablesDirect).toHaveBeenCalledWith(
      expect.objectContaining({ tableIds: ['T5'] }),
    );
  });

  it('restores the original tables when the new ones are refused', async () => {
    bookingService.unassignTablesDirect.mockResolvedValue({ success: true, removedCount: 1 });
    bookingService.assignTablesDirect
      .mockRejectedValueOnce(
        new HttpError({ message: 'Table T4 is too small', status: 422, code: 'CAPACITY' }),
      )
      .mockResolvedValueOnce({ success: true });
    const { queryClient, hook } = setup([makeBooking('b1', 'confirmed', ['T3'])]);

    let caught: unknown;
    await act(async () => {
      caught = await hook.result.current
        .move('b1', ['T3'], ['T4'])
        .catch((error: unknown) => error);
    });

    expect(caught).toMatchObject({
      code: 'VALIDATION',
      restored: true,
      message: 'Table T4 is too small',
    });
    const restoreCall = bookingService.assignTablesDirect.mock.calls[1]![0];
    expect(restoreCall).toMatchObject({ bookingId: 'b1', tableIds: ['T3'] });
    expect(restoreCall.idempotencyKey).not.toBe(
      bookingService.assignTablesDirect.mock.calls[0]![0].idempotencyKey,
    );
    expect(tableIdsOf(queryClient, 'b1')).toMatchObject({ tableIds: ['T3'], status: 'confirmed' });
  });

  it('reports a booking left without a table when the restore also fails', async () => {
    bookingService.unassignTablesDirect.mockResolvedValue({ success: true, removedCount: 1 });
    bookingService.assignTablesDirect.mockRejectedValue(new TypeError('Failed to fetch'));
    const { queryClient, hook } = setup([makeBooking('b1', 'confirmed', ['T3'])]);

    let caught: unknown;
    await act(async () => {
      caught = await hook.result.current
        .move('b1', ['T3'], ['T4'])
        .catch((error: unknown) => error);
    });

    expect(caught).toMatchObject({ code: 'NETWORK', restored: false });
    expect(tableIdsOf(queryClient, 'b1')).toMatchObject({
      tableIds: [],
      status: 'pending',
      requiresTableAssignment: true,
    });
  });

  it('keeps the original tables when releasing them fails', async () => {
    bookingService.unassignTablesDirect.mockRejectedValue(
      new HttpError({ message: 'x', status: 500 }),
    );
    const { queryClient, hook } = setup([makeBooking('b1', 'confirmed', ['T3'])]);

    let caught: unknown;
    await act(async () => {
      caught = await hook.result.current
        .move('b1', ['T3'], ['T4'])
        .catch((error: unknown) => error);
    });

    expect(caught).toMatchObject({ code: 'UNKNOWN', restored: true });
    expect(bookingService.assignTablesDirect).not.toHaveBeenCalled();
    expect(tableIdsOf(queryClient, 'b1').tableIds).toEqual(['T3']);
  });

  it('unassigns and reopens a confirmed booking', async () => {
    bookingService.unassignTablesDirect.mockResolvedValue({ success: true, removedCount: 1 });
    const { queryClient, hook } = setup([makeBooking('b1', 'confirmed', ['T3'])]);

    await act(async () => {
      await hook.result.current.unassign('b1', ['T3']);
    });

    expect(tableIdsOf(queryClient, 'b1')).toMatchObject({ tableIds: [], status: 'pending' });
  });
});
