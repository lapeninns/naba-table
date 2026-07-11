import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import { useOpsTableAssignmentActions } from '@src/hooks/ops/useOpsTableAssignments';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const bookingService = vi.hoisted(() => ({
  assignTable: vi.fn(),
  unassignTable: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

const restaurantId = 'rest-1';
const date = '2026-07-11';
const summaryKey = queryKeys.opsDashboard.summary(restaurantId, date);

const assignedGroup = {
  groupId: null,
  capacitySum: null,
  members: [{ tableId: 'table-1', tableNumber: 'T1', capacity: null, section: null }],
};

function makeSummary(booking: Partial<OpsTodayBooking>): OpsTodayBookingsSummary {
  return {
    restaurantId,
    date,
    timezone: 'UTC',
    bookings: [
      {
        id: 'booking-1',
        status: 'confirmed',
        partySize: 2,
        customerName: 'Guest One',
        tableAssignments: [],
        requiresTableAssignment: true,
        ...booking,
      },
    ],
    totals: {
      total: 1,
      confirmed: 1,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: 1,
      covers: 2,
    },
  } as unknown as OpsTodayBookingsSummary;
}

function seededSetup(booking: Partial<OpsTodayBooking> = {}) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(summaryKey, makeSummary(booking));
  const wrapper = createQueryWrapper(queryClient);
  return {
    queryClient,
    ...renderHook(() => useOpsTableAssignmentActions({ restaurantId, date }), { wrapper }),
  };
}

function cachedBooking(queryClient: ReturnType<typeof createTestQueryClient>) {
  return queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey)?.bookings[0];
}

describe('useOpsTableAssignmentActions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('assignTable', () => {
    it('@contract optimistically adds the table member and clears requiresTableAssignment', async () => {
      let resolveRequest: (value: unknown) => void = () => {};
      bookingService.assignTable.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
      );

      const { result, queryClient } = seededSetup();
      const mutation = result.current.assignTable.mutateAsync({
        bookingId: 'booking-1',
        tableId: 'table-1',
        tableName: 'T1',
      });

      await waitFor(() => {
        const booking = cachedBooking(queryClient);
        expect(booking?.tableAssignments?.[0]?.members).toEqual([
          { tableId: 'table-1', tableNumber: 'T1', capacity: null, section: null },
        ]);
        expect(booking?.requiresTableAssignment).toBe(false);
      });

      resolveRequest({ tableAssignments: [assignedGroup] });
      await mutation;

      expect(bookingService.assignTable).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        tableId: 'table-1',
      });
    });

    it('@contract does not duplicate a member that is already assigned', async () => {
      bookingService.assignTable.mockResolvedValue({ tableAssignments: [assignedGroup] });

      const { result, queryClient } = seededSetup({
        tableAssignments: [assignedGroup],
        requiresTableAssignment: false,
      });

      await result.current.assignTable.mutateAsync({
        bookingId: 'booking-1',
        tableId: 'table-1',
        tableName: 'T1',
      });

      const booking = cachedBooking(queryClient);
      expect(booking?.tableAssignments?.[0]?.members).toHaveLength(1);
    });

    it('@contract rolls the summary back when the assignment fails', async () => {
      bookingService.assignTable.mockRejectedValue(new Error('taken'));

      const { result, queryClient } = seededSetup();

      await expect(
        result.current.assignTable.mutateAsync({
          bookingId: 'booking-1',
          tableId: 'table-1',
          tableName: 'T1',
        }),
      ).rejects.toThrow('taken');

      const booking = cachedBooking(queryClient);
      expect(booking?.tableAssignments).toEqual([]);
      expect(booking?.requiresTableAssignment).toBe(true);
    });

    it('@contract reconciles with the server response, reverting confirmed to pending when empty', async () => {
      bookingService.assignTable.mockResolvedValue({ tableAssignments: [] });

      const { result, queryClient } = seededSetup();

      await result.current.assignTable.mutateAsync({
        bookingId: 'booking-1',
        tableId: 'table-1',
        tableName: 'T1',
      });

      const booking = cachedBooking(queryClient);
      expect(booking?.status).toBe('pending');
      expect(booking?.tableAssignments).toEqual([]);
      expect(booking?.requiresTableAssignment).toBe(true);
    });
  });

  describe('unassignTable', () => {
    it('@contract optimistically removes the member, reverts to pending, and adjusts totals', async () => {
      let resolveRequest: (value: unknown) => void = () => {};
      bookingService.unassignTable.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
      );

      const { result, queryClient } = seededSetup({
        tableAssignments: [assignedGroup],
        requiresTableAssignment: false,
      });

      const mutation = result.current.unassignTable.mutateAsync({
        bookingId: 'booking-1',
        tableId: 'table-1',
      });

      await waitFor(() => {
        const summary = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey);
        const booking = summary?.bookings[0];
        expect(booking?.status).toBe('pending');
        expect(booking?.tableAssignments).toEqual([]);
        expect(booking?.requiresTableAssignment).toBe(true);
        expect(summary?.totals.confirmed).toBe(0);
        expect(summary?.totals.pending).toBe(1);
      });

      resolveRequest({ tableAssignments: [] });
      await mutation;

      expect(bookingService.unassignTable).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        tableId: 'table-1',
      });
    });

    it('@contract leaves the booking untouched when the table was not assigned', async () => {
      bookingService.unassignTable.mockResolvedValue({ tableAssignments: [assignedGroup] });

      const { result, queryClient } = seededSetup({
        tableAssignments: [assignedGroup],
        requiresTableAssignment: false,
      });

      await result.current.unassignTable.mutateAsync({
        bookingId: 'booking-1',
        tableId: 'table-unknown',
      });

      const booking = cachedBooking(queryClient);
      expect(booking?.status).toBe('confirmed');
      expect(booking?.tableAssignments?.[0]?.members).toHaveLength(1);
    });

    it('@contract rolls the summary back when the unassignment fails', async () => {
      bookingService.unassignTable.mockRejectedValue(new Error('locked'));

      const { result, queryClient } = seededSetup({
        tableAssignments: [assignedGroup],
        requiresTableAssignment: false,
      });

      await expect(
        result.current.unassignTable.mutateAsync({
          bookingId: 'booking-1',
          tableId: 'table-1',
        }),
      ).rejects.toThrow('locked');

      const booking = cachedBooking(queryClient);
      expect(booking?.status).toBe('confirmed');
      expect(booking?.tableAssignments?.[0]?.members).toHaveLength(1);
    });
  });
});
