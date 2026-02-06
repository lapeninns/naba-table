import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { BookingDTO, BookingsPage } from '@/hooks/useBookings';

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: vi.fn(),
}));

vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

describe('useUpdateBooking', () => {
  it('updates booking details and refreshes cache', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const booking: BookingDTO = {
      id: 'booking-1',
      restaurantName: 'The Fox',
      partySize: 2,
      startIso: '2026-02-10T19:00:00Z',
      endIso: '2026-02-10T20:30:00Z',
      status: 'confirmed',
    };

    const updated: BookingDTO = {
      ...booking,
      partySize: 4,
      notes: 'Updated request',
    };

    const page: BookingsPage = {
      items: [booking],
      pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
    };

    queryClient.setQueryData(queryKeys.bookings.all, page);
    queryClient.setQueryData(queryKeys.bookings.detail(booking.id), booking);
    vi.mocked(fetchJson).mockResolvedValue(updated as never);

    const { result } = renderHook(() => useUpdateBooking(), { wrapper });

    await result.current.mutateAsync({
      id: booking.id,
      startIso: updated.startIso,
      endIso: updated.endIso,
      partySize: updated.partySize,
      notes: updated.notes,
    });

    expect(fetchJson).toHaveBeenCalledWith(`/api/bookings/${booking.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startIso: updated.startIso,
        endIso: updated.endIso,
        partySize: updated.partySize,
        notes: updated.notes,
      }),
    });

    expect(queryClient.getQueryData(queryKeys.bookings.detail(booking.id))).toEqual(updated);
  });
});
