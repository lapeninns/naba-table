import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useCancelBooking } from '@/hooks/useCancelBooking';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { reservationKeys } from '@shared/api/queryKeys';

import type { QueryClient, QueryKey } from '@tanstack/react-query';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

const ID = 'b-1';
const OTHER = 'b-2';

function seed(queryClient: QueryClient) {
  const keys: Record<string, QueryKey> = {
    list: queryKeys.bookings.list({ page: 1 }),
    detail: queryKeys.bookings.detail(ID),
    history: queryKeys.bookings.history(ID, { limit: 10 }),
    otherDetail: queryKeys.bookings.detail(OTHER),
    otherHistory: queryKeys.bookings.history(OTHER, { limit: 10 }),
  };
  for (const key of Object.values(keys)) {
    queryClient.setQueryData(key, { items: [] });
  }
  return keys;
}

function invalidated(queryClient: QueryClient, key: QueryKey): boolean {
  return queryClient.getQueryState(key)?.isInvalidated ?? false;
}

describe('guest booking mutations invalidate only the affected booking queries', () => {
  it('cancel invalidates the lists and this booking, not other bookings', async () => {
    const queryClient = createTestQueryClient();
    const keys = seed(queryClient);
    vi.mocked(fetchJson).mockResolvedValue({ id: ID, status: 'cancelled' } as never);
    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createQueryWrapper(queryClient),
    });
    await result.current.mutateAsync({ id: ID });

    expect(invalidated(queryClient, keys.list!)).toBe(true);
    expect(invalidated(queryClient, keys.detail!)).toBe(true);
    expect(invalidated(queryClient, keys.history!)).toBe(true);
    expect(invalidated(queryClient, keys.otherDetail!)).toBe(false);
    expect(invalidated(queryClient, keys.otherHistory!)).toBe(false);
  });

  it('update invalidates the lists and this booking, not other bookings', async () => {
    const queryClient = createTestQueryClient();
    const keys = seed(queryClient);
    vi.mocked(fetchJson).mockResolvedValue({ id: ID } as never);
    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: createQueryWrapper(queryClient),
    });
    await result.current.mutateAsync({ id: ID, startIso: '2026-10-01T19:00:00Z', partySize: 2 });

    expect(invalidated(queryClient, keys.list!)).toBe(true);
    expect(invalidated(queryClient, keys.history!)).toBe(true);
    expect(invalidated(queryClient, keys.otherDetail!)).toBe(false);
    expect(invalidated(queryClient, keys.otherHistory!)).toBe(false);
  });
});

describe('guest booking update refreshes only its own restaurant schedule', () => {
  const foxSchedule = ['reservations', 'schedule', 'the-fox', '2026-10-01', 2];
  const bellSchedule = ['reservations', 'schedule', 'the-bell', '2026-10-01', 2];

  function seedSchedules(queryClient: QueryClient) {
    queryClient.setQueryData(foxSchedule, { seeded: true });
    queryClient.setQueryData(bellSchedule, { seeded: true });
  }

  it("narrows the schedule refresh to the cached booking's restaurant", async () => {
    const queryClient = createTestQueryClient();
    seedSchedules(queryClient);
    queryClient.setQueryData(reservationKeys.detail(ID), {
      id: ID,
      restaurantSlug: 'the-fox',
      bookingDate: '2026-09-30',
    });
    vi.mocked(fetchJson).mockResolvedValue({ id: ID } as never);
    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: createQueryWrapper(queryClient),
    });
    await result.current.mutateAsync({ id: ID, startIso: '2026-10-01T19:00:00Z', partySize: 2 });

    expect(invalidated(queryClient, foxSchedule)).toBe(true);
    expect(invalidated(queryClient, bellSchedule)).toBe(false);
  });

  it('falls back to every schedule when the restaurant is unknown', async () => {
    const queryClient = createTestQueryClient();
    seedSchedules(queryClient);
    vi.mocked(fetchJson).mockResolvedValue({ id: ID } as never);
    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: createQueryWrapper(queryClient),
    });
    await result.current.mutateAsync({ id: ID, startIso: '2026-10-01T19:00:00Z', partySize: 2 });

    expect(invalidated(queryClient, foxSchedule)).toBe(true);
    expect(invalidated(queryClient, bellSchedule)).toBe(true);
  });
});
