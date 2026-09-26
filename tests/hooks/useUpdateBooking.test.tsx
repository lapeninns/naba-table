import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { reservationKeys } from '@shared/api/queryKeys';

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

    queryClient.setQueryData(queryKeys.bookings.list(), page);
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
      authRedirect: true,
    });

    expect(queryClient.getQueryData(queryKeys.bookings.detail(booking.id))).toEqual(updated);
  });

  it('writes the normalized reservation detail cache from a returned booking payload', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const bookingId = '11111111-1111-4111-8111-111111111111';

    vi.mocked(fetchJson).mockResolvedValue({
      id: bookingId,
      restaurantName: 'The Fox',
      partySize: 4,
      startIso: '2026-07-02T18:30:00.000Z',
      endIso: '2026-07-02T20:00:00.000Z',
      status: 'confirmed',
      booking: {
        id: bookingId,
        restaurant_id: '22222222-2222-4222-8222-222222222222',
        booking_date: '2026-07-02',
        start_time: '19:30',
        end_time: '21:00',
        start_at: '2026-07-02T18:30:00.000Z',
        end_at: '2026-07-02T20:00:00.000Z',
        booking_type: 'dinner',
        status: 'confirmed',
        party_size: 4,
        customer_name: 'Alex Guest',
        customer_email: 'alex@example.com',
        customer_phone: '+447700900123',
        marketing_opt_in: false,
        notes: 'Updated request',
        restaurants: {
          name: 'The Fox',
          slug: 'the-fox',
          timezone: 'Europe/London',
        },
      },
    } as never);

    const { result } = renderHook(() => useUpdateBooking(), { wrapper });

    await result.current.mutateAsync({
      id: bookingId,
      startIso: '2026-07-02T18:30:00.000Z',
      endIso: '2026-07-02T20:00:00.000Z',
      partySize: 4,
      notes: 'Updated request',
    });

    expect(queryClient.getQueryData(reservationKeys.detail(bookingId))).toMatchObject({
      id: bookingId,
      bookingDate: '2026-07-02',
      startTime: '19:30',
      startAt: '2026-07-02T18:30:00.000Z',
      endAt: '2026-07-02T20:00:00.000Z',
      partySize: 4,
    });
  });
});

describe('useUpdateBooking guest error copy', () => {
  it('maps guest access codes to guest copy and keeps the code', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useUpdateBooking(), { wrapper });

    vi.mocked(fetchJson).mockRejectedValueOnce(
      new HttpError({
        message: 'Invalid or missing CSRF token',
        status: 403,
        code: 'CSRF_INVALID',
      }),
    );

    await expect(
      result.current.mutateAsync({ id: 'b-1', startIso: '2026-10-10T18:00:00.000Z', partySize: 2 }),
    ).rejects.toMatchObject({
      code: 'CSRF_INVALID',
      status: 403,
      message: 'Your session expired. Refresh the page and try again.',
    });
  });
});
