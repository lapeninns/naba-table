import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useCancelBooking } from '@/hooks/useCancelBooking';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { BookingDTO, BookingsPage } from '@/hooks/useBookings';

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

describe('useCancelBooking', () => {
  it('marks bookings as cancelled after success', async () => {
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

    const page: BookingsPage = {
      items: [booking],
      pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
    };

    queryClient.setQueryData(queryKeys.bookings.all, page);
    queryClient.setQueryData(queryKeys.bookings.detail(booking.id), booking);

    vi.mocked(fetchJson).mockResolvedValue({ id: booking.id, status: 'cancelled' } as never);

    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await result.current.mutateAsync({ id: booking.id });

    const list = queryClient.getQueryData<BookingsPage>(queryKeys.bookings.all);
    const detail = queryClient.getQueryData<BookingDTO>(queryKeys.bookings.detail(booking.id));

    expect(fetchJson).toHaveBeenCalledWith(`/api/bookings/${booking.id}`, { method: 'DELETE' });
    expect(list?.items[0]?.status).toBe('cancelled');
    expect(detail?.status).toBe('cancelled');
  });

  it('restores cached data on error', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const booking: BookingDTO = {
      id: 'booking-2',
      restaurantName: 'The Fox',
      partySize: 2,
      startIso: '2026-02-11T19:00:00Z',
      endIso: '2026-02-11T20:30:00Z',
      status: 'confirmed',
    };

    const page: BookingsPage = {
      items: [booking],
      pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
    };

    queryClient.setQueryData(queryKeys.bookings.all, page);
    queryClient.setQueryData(queryKeys.bookings.detail(booking.id), booking);

    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Locked', status: 409, code: 'PENDING_LOCKED' }),
    );

    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await expect(result.current.mutateAsync({ id: booking.id })).rejects.toThrow('Locked');

    const list = queryClient.getQueryData<BookingsPage>(queryKeys.bookings.all);
    const detail = queryClient.getQueryData<BookingDTO>(queryKeys.bookings.detail(booking.id));

    expect(list?.items[0]?.status).toBe('confirmed');
    expect(detail?.status).toBe('confirmed');
  });
});

describe('useCancelBooking guest error copy', () => {
  it('maps access failures to guest copy and hides 5xx server text', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    vi.mocked(fetchJson).mockRejectedValueOnce(
      new HttpError({ message: 'raw', status: 410, code: 'ACCESS_TOKEN_REVOKED' }),
    );
    await expect(result.current.mutateAsync({ id: 'b-1' })).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_REVOKED',
      status: 410,
      message: 'This booking link is no longer valid. Request a new link from the booking page.',
    });

    vi.mocked(fetchJson).mockRejectedValueOnce(
      new HttpError({ message: 'relation "bookings" does not exist', status: 500, code: 'X' }),
    );
    await expect(result.current.mutateAsync({ id: 'b-1' })).rejects.toMatchObject({
      message: 'Something went wrong on our side. Try again.',
    });
  });
});
