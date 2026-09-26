import { act, renderHook } from '@testing-library/react';
import { createQueryWrapper } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useTableAssignmentMutations } from '@/components/features/dashboard/booking-details/hooks/useTableAssignmentMutations';
import { queryKeys } from '@/lib/query/keys';

import {
  RESTAURANT_ID,
  createFeedbackQueryClient,
  makeRow,
  makeSummary,
  summaryKey,
} from './__helpers__/opsBookingFixtures';

const bookingService = vi.hoisted(() => ({
  assignTablesDirect: vi.fn(),
  unassignTablesDirect: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({ useBookingService: () => bookingService }));

function setup(status: 'pending' | 'confirmed') {
  const { queryClient } = createFeedbackQueryClient();
  queryClient.setQueryData(summaryKey(), makeSummary([makeRow({ id: 'b1', status })]));
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const hook = renderHook(
    () =>
      useTableAssignmentMutations({
        bookingId: 'b1',
        onAssignmentComplete: undefined,
        restaurantId: RESTAURANT_ID,
        resetSelectedTables: () => {},
      }),
    { wrapper: createQueryWrapper(queryClient) },
  );
  const statusSummaryInvalidated = () =>
    invalidate.mock.calls.some(
      ([filters]) =>
        JSON.stringify(filters?.queryKey) ===
        JSON.stringify(queryKeys.opsBookings.statusSummaryPrefix(RESTAURANT_ID)),
    );
  return { ...hook, statusSummaryInvalidated };
}

describe('useTableAssignmentMutations', () => {
  it('@contract refreshes the bookings-page status counts when assigning confirms a pending booking', async () => {
    bookingService.assignTablesDirect.mockResolvedValue({
      assignments: [{ table_id: 't1' }],
      booking: { id: 'b1', status: 'confirmed', party_size: 2 },
    });
    const { result, statusSummaryInvalidated } = setup('pending');

    await act(async () => {
      await result.current.assignMutation.mutateAsync({
        bookingId: 'b1',
        tableIds: ['t1'],
        idempotencyKey: 'intent-1',
      });
    });

    expect(statusSummaryInvalidated()).toBe(true);
  });

  it('@contract leaves the status counts alone when the status did not change', async () => {
    bookingService.assignTablesDirect.mockResolvedValue({
      assignments: [{ table_id: 't1' }],
      booking: { id: 'b1', status: 'confirmed', party_size: 2 },
    });
    const { result, statusSummaryInvalidated } = setup('confirmed');

    await act(async () => {
      await result.current.assignMutation.mutateAsync({
        bookingId: 'b1',
        tableIds: ['t1'],
        idempotencyKey: 'intent-2',
      });
    });

    expect(statusSummaryInvalidated()).toBe(false);
  });
});
