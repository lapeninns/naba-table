import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import {
  buildOpsBookingPayload,
  useCreateOpsReservation,
} from '@features/reservations/wizard/api/useCreateOpsReservation';

import type { ReservationDraft } from '@features/reservations/wizard/model/reducer';

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: vi.fn(),
}));

vi.mock('@entities/reservation/adapter', () => ({
  reservationAdapter: vi.fn(),
  reservationListAdapter: vi.fn(),
}));

vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));
vi.mock('@shared/lib/analytics', () => ({ track: vi.fn() }));

describe('buildOpsBookingPayload', () => {
  it('maps a wizard draft to the ops bookings payload', () => {
    const payload = buildOpsBookingPayload({
      restaurantId: '9b95a1f4-f6f7-40f1-a99c-41ecffdf9957',
      restaurantSlug: 'the-fox',
      date: '2026-03-29',
      time: '18:30',
      party: 4,
      bookingType: 'dinner',
      notes: 'Window seat if available',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: null,
      marketingOptIn: false,
    });

    expect(payload).toEqual({
      restaurantId: '9b95a1f4-f6f7-40f1-a99c-41ecffdf9957',
      date: '2026-03-29',
      time: '18:30',
      party: 4,
      bookingType: 'dinner',
      seating: 'any',
      notes: 'Window seat if available',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: null,
      marketingOptIn: false,
    });
  });
});

describe('useCreateOpsReservation', () => {
  it('reuses the idempotency key after an ambiguous network failure', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const draft: ReservationDraft = {
      restaurantId: '9b95a1f4-f6f7-40f1-a99c-41ecffdf9957',
      restaurantSlug: 'the-fox',
      date: '2026-03-29',
      time: '18:30',
      party: 4,
      bookingType: 'dinner',
      notes: null,
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: null,
      marketingOptIn: false,
    };
    const booking = { id: 'booking-1' };

    vi.mocked(fetchJson)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ booking, bookings: [booking] });
    vi.mocked(reservationAdapter).mockReturnValue({ id: 'booking-1' } as never);
    vi.mocked(reservationListAdapter).mockReturnValue([{ id: 'booking-1' }] as never);

    const { result } = renderHook(() => useCreateOpsReservation(), { wrapper });

    await expect(result.current.mutateAsync({ draft })).rejects.toThrow('Failed to fetch');
    await result.current.mutateAsync({ draft });

    const firstOptions = vi.mocked(fetchJson).mock.calls[0]?.[1];
    const secondOptions = vi.mocked(fetchJson).mock.calls[1]?.[1];
    expect(firstOptions?.headers).toEqual(secondOptions?.headers);
  });
});

describe('useCreateOpsReservation cache invalidation', () => {
  it('refreshes the status counts and heatmap for its restaurant and only its own schedule date', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const restaurantId = '9b95a1f4-f6f7-40f1-a99c-41ecffdf9957';
    const draft: ReservationDraft = {
      restaurantId,
      restaurantSlug: 'the-fox',
      date: '2026-03-29',
      time: '18:30',
      party: 4,
      bookingType: 'dinner',
      notes: null,
      name: 'Guest Booker',
      email: null,
      phone: null,
      marketingOptIn: false,
    };
    const ownSchedule = [...queryKeys.reservations.schedulePrefix(), 'the-fox', '2026-03-29', 4];
    const ownScheduleOtherParty = [
      ...queryKeys.reservations.schedulePrefix(),
      'the-fox',
      '2026-03-29',
      'raw',
    ];
    const ownScheduleOtherDate = [
      ...queryKeys.reservations.schedulePrefix(),
      'the-fox',
      '2026-03-30',
      4,
    ];
    const otherSchedule = [...queryKeys.reservations.schedulePrefix(), 'the-bell', '2026-03-29', 4];
    const calendarMask = ['reservations', 'calendar-mask', 'the-fox', '2026-03-01', '2026-03-31'];
    const statusSummary = [...queryKeys.opsBookings.statusSummaryPrefix(restaurantId), 'x'];
    const heatmap = [...queryKeys.opsDashboard.heatmapPrefix(restaurantId), 'x'];
    for (const key of [
      ownSchedule,
      ownScheduleOtherParty,
      ownScheduleOtherDate,
      otherSchedule,
      calendarMask,
      statusSummary,
      heatmap,
    ]) {
      queryClient.setQueryData(key, { seeded: true });
    }

    vi.mocked(fetchJson)
      .mockReset()
      .mockResolvedValueOnce({ booking: { id: 'b1' }, bookings: [] });
    vi.mocked(reservationAdapter).mockReturnValue({ id: 'b1' } as never);
    vi.mocked(reservationListAdapter).mockReturnValue([] as never);

    const { result } = renderHook(() => useCreateOpsReservation(), { wrapper });
    await result.current.mutateAsync({ draft });

    const invalidated = (key: readonly unknown[]) =>
      queryClient.getQueryState(key)?.isInvalidated ?? false;
    expect(invalidated(ownSchedule)).toBe(true);
    expect(invalidated(ownScheduleOtherParty)).toBe(true);
    expect(invalidated(ownScheduleOtherDate)).toBe(false);
    expect(invalidated(otherSchedule)).toBe(false);
    expect(invalidated(calendarMask)).toBe(false);
    expect(invalidated(statusSummary)).toBe(true);
    expect(invalidated(heatmap)).toBe(true);
  });
});
