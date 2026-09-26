import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { useCreateOpsReservation } from '@features/reservations/wizard/api/useCreateOpsReservation';

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

const RESTAURANT_ID = '9b95a1f4-f6f7-40f1-a99c-41ecffdf9957';
const draft: ReservationDraft = {
  restaurantId: RESTAURANT_ID,
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
  whatsappOptIn: false,
};

function sentKeys(): string[] {
  return vi
    .mocked(fetchJson)
    .mock.calls.map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']!);
}

describe('useCreateOpsReservation idempotency, retry and invalidation', () => {
  beforeEach(() => {
    vi.mocked(fetchJson).mockReset();
    vi.mocked(reservationAdapter).mockReturnValue({ id: 'booking-1' } as never);
    vi.mocked(reservationListAdapter).mockReturnValue([] as never);
  });

  it('retries a retryable 409 once after retryAfter with the same key', async () => {
    vi.mocked(fetchJson)
      .mockRejectedValueOnce(
        new HttpError({
          message: 'This time slot was just booked. Please try again.',
          status: 409,
          code: 'BOOKING_CONFLICT',
          retryable: true,
          retryAfter: 0.01,
        }),
      )
      .mockResolvedValueOnce({ booking: { id: 'booking-1' }, bookings: [] });
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCreateOpsReservation(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await result.current.mutateAsync({ draft });

    const keys = sentKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('refreshes the dashboard summary for the booking date and the ops bookings lists', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ booking: { id: 'booking-1' }, bookings: [] });
    const queryClient = createTestQueryClient();
    const summaryForDate = queryKeys.opsDashboard.summary(RESTAURANT_ID, '2026-03-29');
    const summaryToday = queryKeys.opsDashboard.summary(RESTAURANT_ID, null);
    const otherDate = queryKeys.opsDashboard.summary(RESTAURANT_ID, '2026-04-01');
    const otherRestaurant = queryKeys.opsDashboard.summary('other-restaurant', '2026-03-29');
    const list = queryKeys.opsBookings.list({ page: 1 });
    const heatmap = queryKeys.opsDashboard.heatmap(RESTAURANT_ID, '2026-03-01', '2026-03-31');
    for (const key of [summaryForDate, summaryToday, otherDate, otherRestaurant, list, heatmap]) {
      queryClient.setQueryData(key, { cached: true });
    }
    const { result } = renderHook(() => useCreateOpsReservation(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await result.current.mutateAsync({ draft });

    const invalidated = (key: readonly unknown[]) =>
      queryClient.getQueryState(key)?.isInvalidated ?? false;
    expect(invalidated(summaryForDate)).toBe(true);
    expect(invalidated(summaryToday)).toBe(true);
    expect(invalidated(list)).toBe(true);
    expect(invalidated(otherDate)).toBe(false);
    expect(invalidated(otherRestaurant)).toBe(false);
    expect(invalidated(heatmap)).toBe(false);
  });

  it('sends a v4 uuid key and a new one after the walk-in succeeds', async () => {
    vi.mocked(fetchJson)
      .mockResolvedValueOnce({ booking: { id: 'booking-1' }, bookings: [] })
      .mockResolvedValueOnce({ booking: { id: 'booking-2' }, bookings: [] });
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCreateOpsReservation(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await result.current.mutateAsync({ draft });
    await result.current.mutateAsync({ draft });

    const keys = sentKeys();
    expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(keys[1]).not.toBe(keys[0]);
  });
});
