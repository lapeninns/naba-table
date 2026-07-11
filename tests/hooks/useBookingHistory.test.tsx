import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useBookingHistory } from '@/hooks/useBookingHistory';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

function setup(id: string | undefined) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useBookingHistory(id), { wrapper });
}

describe('useBookingHistory', () => {
  it('@contract stays disabled while the reservation id is missing', () => {
    const { result } = setup(undefined);

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('@contract fetches the booking history for the provided id', async () => {
    const response = {
      events: [{ id: 'evt-1', type: 'created' }],
      pagination: { limit: 20, offset: 0, count: 1 },
    };
    vi.mocked(fetchJson).mockResolvedValue(response as never);

    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchJson).toHaveBeenCalledWith('/api/bookings/booking-1/history');
    expect(result.current.data).toEqual(response);
  });

  it('@contract surfaces http errors from the history endpoint', async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Not found', status: 404, code: 'NOT_FOUND' }),
    );

    const { result } = setup('booking-404');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(HttpError);
    expect(result.current.error?.status).toBe(404);
  });
});
