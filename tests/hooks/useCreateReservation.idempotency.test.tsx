import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { useCreateReservation } from '@features/reservations/wizard/api/useCreateReservation';
import { apiClient } from '@shared/api/client';

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

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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
  whatsappOptIn: false,
};

function retryableConflict(retryAfter = 0.01) {
  return {
    code: 'BOOKING_CONFLICT',
    message: 'This time slot was just booked. Please try again.',
    status: 409,
    body: { code: 'BOOKING_CONFLICT', retryable: true, retryAfter },
  };
}

function sentKeys(): string[] {
  return vi
    .mocked(apiClient.post)
    .mock.calls.map(([, , init]) => (init?.headers as Record<string, string>)['Idempotency-Key']!);
}

function render() {
  const queryClient = createTestQueryClient();
  return renderHook(() => useCreateReservation(), { wrapper: createQueryWrapper(queryClient) });
}

describe('useCreateReservation idempotency and conflict retry', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(reservationAdapter).mockReturnValue({ id: 'booking-1' } as never);
    vi.mocked(reservationListAdapter).mockReturnValue([] as never);
  });

  it('sends a v4 uuid key', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ booking: { id: 'booking-1' }, bookings: [] });
    const { result } = render();

    await result.current.mutateAsync({ draft });

    expect(sentKeys()[0]).toMatch(UUID_V4);
  });

  it('retries a retryable 409 once after retryAfter with the same key', async () => {
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce(retryableConflict())
      .mockResolvedValueOnce({ booking: { id: 'booking-1' }, bookings: [] });
    const { result } = render();

    await expect(result.current.mutateAsync({ draft })).resolves.toMatchObject({
      booking: { id: 'booking-1' },
    });

    const keys = sentKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('gives up after one conflict retry and starts a new intent afterwards', async () => {
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce(retryableConflict())
      .mockRejectedValueOnce(retryableConflict())
      .mockResolvedValueOnce({ booking: { id: 'booking-2' }, bookings: [] });
    const { result } = render();

    await expect(result.current.mutateAsync({ draft })).rejects.toMatchObject({
      code: 'BOOKING_CONFLICT',
    });
    expect(apiClient.post).toHaveBeenCalledTimes(2);

    await result.current.mutateAsync({ draft });
    const keys = sentKeys();
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('does not retry a non-retryable 409', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      code: 'CAPACITY_EXCEEDED',
      message: 'No tables are available.',
      status: 409,
      body: { code: 'CAPACITY_EXCEEDED' },
    });
    const { result } = render();

    await expect(result.current.mutateAsync({ draft })).rejects.toMatchObject({
      code: 'CAPACITY_EXCEEDED',
    });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('keeps the key for an unchanged draft but uses a new key once the guest edits it', async () => {
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ booking: { id: 'booking-1' }, bookings: [] });
    const { result } = render();

    await expect(result.current.mutateAsync({ draft })).rejects.toThrow('Failed to fetch');
    await expect(result.current.mutateAsync({ draft: { ...draft } })).rejects.toThrow(
      'Failed to fetch',
    );
    await result.current.mutateAsync({ draft: { ...draft, party: 3 } });

    const keys = sentKeys();
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('uses a caller-provided key from the mutation variables', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ booking: { id: 'booking-1' }, bookings: [] });
    const { result } = render();
    const idempotencyKey = '0f8fad5b-d9cb-469f-a165-70867728950e';

    await result.current.mutateAsync({ draft, idempotencyKey });

    expect(sentKeys()).toEqual([idempotencyKey]);
  });

  it('treats IDEMPOTENCY_KEY_REUSED as terminal and moves to a new key', async () => {
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This booking request was already used with different details.',
        status: 409,
        body: { code: 'IDEMPOTENCY_KEY_REUSED', retryable: false },
      })
      .mockResolvedValueOnce({ booking: { id: 'booking-1' }, bookings: [] });
    const { result } = render();

    await expect(result.current.mutateAsync({ draft })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    await result.current.mutateAsync({ draft });

    const keys = sentKeys();
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });
});
