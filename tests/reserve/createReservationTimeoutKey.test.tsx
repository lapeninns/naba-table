/**
 * Contract the wizard's timeout retry (§10) relies on: the create hook keeps
 * the same Idempotency-Key across a TIMEOUT, so the retry replays the same
 * booking server-side instead of creating a second one.
 */
import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useCreateReservation } from '@features/reservations/wizard/api/useCreateReservation';
import { apiClient } from '@shared/api/client';

import type { ReservationDraft } from '@features/reservations/wizard/model/reducer';

vi.mock('@shared/api/client', () => ({
  apiClient: { post: vi.fn(), put: vi.fn() },
}));
vi.mock('@entities/reservation/adapter', () => ({
  reservationAdapter: vi.fn((value: unknown) => value),
  reservationListAdapter: vi.fn(() => []),
}));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));
vi.mock('@shared/lib/analytics', () => ({ track: vi.fn() }));

const draft: ReservationDraft = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  restaurantSlug: 'the-fox',
  date: '2026-10-10',
  time: '19:00',
  party: 2,
  bookingType: 'dinner',
  notes: null,
  name: 'Guest Booker',
  email: 'guest@example.com',
  phone: '+447700900123',
  marketingOptIn: false,
};

describe('create reservation idempotency across timeouts', () => {
  it('reuses the Idempotency-Key when retrying after a TIMEOUT', async () => {
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce({ code: 'TIMEOUT' })
      .mockResolvedValueOnce({ booking: { id: 'b-1' }, bookings: [] });

    const wrapper = createQueryWrapper(createTestQueryClient());
    const { result } = renderHook(() => useCreateReservation(), { wrapper });

    await expect(result.current.mutateAsync({ draft })).rejects.toMatchObject({ code: 'TIMEOUT' });
    await result.current.mutateAsync({ draft });

    const keys = vi
      .mocked(apiClient.post)
      .mock.calls.map(
        (call) => (call[2] as { headers: Record<string, string> }).headers['Idempotency-Key'],
      );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});
