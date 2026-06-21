import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { fetchJson } from '@/lib/http/fetchJson';
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
