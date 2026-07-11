import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAssignmentContext } from '@src/hooks/ops/useAssignmentContext';

const bookingService = vi.hoisted(() => ({
  getAssignmentContext: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

const assignmentContext = {
  booking: { id: 'booking-1', restaurant_id: 'rest-1' },
  tables: [],
};

function setup(options: Parameters<typeof useAssignmentContext>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useAssignmentContext(options), { wrapper });
}

describe('useAssignmentContext', () => {
  beforeEach(() => {
    bookingService.getAssignmentContext.mockResolvedValue(assignmentContext);
  });

  it('@contract fetches and exposes the assignment context', async () => {
    const { result } = setup({ bookingId: 'booking-1' });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.data).toEqual(assignmentContext));
    expect(bookingService.getAssignmentContext).toHaveBeenCalledWith('booking-1');
    expect(result.current.isError).toBe(false);
  });

  it('@contract stays idle when disabled', () => {
    setup({ bookingId: 'booking-1', enabled: false });

    expect(bookingService.getAssignmentContext).not.toHaveBeenCalled();
  });

  it('@contract stays idle without a booking id', () => {
    setup({ bookingId: '' });

    expect(bookingService.getAssignmentContext).not.toHaveBeenCalled();
  });

  it('@contract exposes service errors', async () => {
    bookingService.getAssignmentContext.mockRejectedValue(new Error('boom'));

    const { result } = setup({ bookingId: 'booking-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('boom');
  });

  it('@contract supports manual refetch', async () => {
    const { result } = setup({ bookingId: 'booking-1' });
    await waitFor(() => expect(result.current.data).toEqual(assignmentContext));

    await result.current.refetch();

    expect(bookingService.getAssignmentContext).toHaveBeenCalledTimes(2);
  });
});
