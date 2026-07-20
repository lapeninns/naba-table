import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { useCreateReservation } from '@features/reservations/wizard/api/useCreateReservation';
import { apiClient } from '@shared/api/client';
import { reservationKeys } from '@shared/api/queryKeys';

import type { ReservationDraft } from '@features/reservations/wizard/model/reducer';

vi.mock('@shared/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@entities/reservation/adapter', () => ({
  reservationAdapter: vi.fn(),
  reservationListAdapter: vi.fn(),
}));

vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));
vi.mock('@shared/lib/analytics', () => ({ track: vi.fn() }));

describe('useCreateReservation', () => {
  it('submits a new booking and caches the result', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const draft: ReservationDraft = {
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      date: '2026-02-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      notes: 'Window please',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '+441234567890',
      marketingOptIn: false,
    };

    const booking = { id: 'booking-1' };
    const adapted = { id: 'booking-1' };

    vi.mocked(apiClient.post).mockResolvedValue({ booking, bookings: [booking] });
    vi.mocked(reservationAdapter).mockReturnValue(adapted as never);
    vi.mocked(reservationListAdapter).mockReturnValue([adapted] as never);

    const { result } = renderHook(() => useCreateReservation(), { wrapper });

    await result.current.mutateAsync({ draft });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/bookings',
      expect.objectContaining({
        restaurantId: 'rest-1',
        restaurantSlug: 'the-fox',
        date: '2026-02-10',
        time: '19:00',
        party: 2,
        bookingType: 'dinner',
        notes: 'Window please',
        name: 'Guest Booker',
        email: 'guest@example.com',
        phone: '+441234567890',
        marketingOptIn: false,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
        timeoutMs: expect.any(Number),
      }),
    );

    expect(reservationAdapter).toHaveBeenCalledWith(booking);
    expect(reservationListAdapter).toHaveBeenCalledWith([booking]);
    expect(queryClient.getQueryData(reservationKeys.detail('booking-1'))).toEqual(adapted);
  });

  it('reuses the idempotency key after an ambiguous network failure', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const draft: ReservationDraft = {
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      date: '2026-02-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      notes: null,
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '+441234567890',
      marketingOptIn: false,
    };

    const booking = { id: 'booking-1' };
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ booking, bookings: [booking] });
    vi.mocked(reservationAdapter).mockReturnValue({ id: 'booking-1' } as never);
    vi.mocked(reservationListAdapter).mockReturnValue([{ id: 'booking-1' }] as never);

    const { result } = renderHook(() => useCreateReservation(), { wrapper });

    await expect(result.current.mutateAsync({ draft })).rejects.toThrow('Failed to fetch');
    await result.current.mutateAsync({ draft });

    const firstHeaders = vi.mocked(apiClient.post).mock.calls[0]?.[2]?.headers as Record<
      string,
      string
    >;
    const secondHeaders = vi.mocked(apiClient.post).mock.calls[1]?.[2]?.headers as Record<
      string,
      string
    >;
    // The idempotency key and attempt id stay stable across retries of one
    // logical submission; the attempt counter increments so analytics can
    // distinguish retries from independent failures.
    expect(firstHeaders['Idempotency-Key']).toEqual(secondHeaders['Idempotency-Key']);
    expect(firstHeaders['X-Booking-Attempt-Id']).toEqual(secondHeaders['X-Booking-Attempt-Id']);
    expect(firstHeaders['X-Booking-Attempt']).toBe('1');
    expect(secondHeaders['X-Booking-Attempt']).toBe('2');
  });

  it('emits only the canonical wizard_submit_failed event with attempt correlation', async () => {
    const { track } = await import('@shared/lib/analytics');
    const { emit } = await import('@/lib/analytics/emit');
    vi.mocked(track).mockClear();
    vi.mocked(emit).mockClear();

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const draft: ReservationDraft = {
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      date: '2026-02-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      notes: null,
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '+441234567890',
      marketingOptIn: false,
    };

    vi.mocked(apiClient.post).mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'INTERNAL', status: 500 }),
    );

    const { result } = renderHook(() => useCreateReservation(), { wrapper });
    await expect(result.current.mutateAsync({ draft })).rejects.toThrow('boom');

    const trackedEvents = vi.mocked(track).mock.calls.map(([event]) => event);
    expect(trackedEvents).toEqual(['wizard_submit_failed']);
    expect(trackedEvents).not.toContain('reserve_submit_failed');

    const [, payload] = vi.mocked(track).mock.calls[0]!;
    expect(payload).toMatchObject({
      code: 'INTERNAL',
      status: 500,
      context: 'customer',
      attemptId: expect.any(String),
      attempt: 1,
    });
    expect(vi.mocked(emit)).toHaveBeenCalledWith(
      'wizard_submit_failed',
      expect.objectContaining({ attempt: 1, attemptId: expect.any(String) }),
    );
  });

  it('uses the update path when a booking id is provided', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const draft: ReservationDraft = {
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      date: '2026-02-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      notes: null,
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: null,
      marketingOptIn: false,
    };

    vi.mocked(apiClient.put).mockResolvedValue({ booking: null, bookings: [] });

    const { result } = renderHook(() => useCreateReservation(), { wrapper });

    await result.current.mutateAsync({ draft, bookingId: 'booking-1' });

    expect(apiClient.put).toHaveBeenCalledWith(
      '/bookings/booking-1',
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
      }),
    );
  });
});
