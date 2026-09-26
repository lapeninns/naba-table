import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useCancelBooking } from '@/hooks/useCancelBooking';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { reservationKeys } from '@shared/api/queryKeys';

import type { QueryClient, QueryKey } from '@tanstack/react-query';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

const ID = 'b-1';

function invalidated(queryClient: QueryClient, key: QueryKey): boolean {
  return queryClient.getQueryState(key)?.isInvalidated ?? false;
}

describe('guest cancel frees the slot in open booking schedules', () => {
  it("invalidates the cancelled booking's restaurant schedule only", async () => {
    const queryClient = createTestQueryClient();
    const own = [...queryKeys.reservations.scheduleFor('the-bell'), '2026-10-01'] as QueryKey;
    const other = [...queryKeys.reservations.scheduleFor('the-railway'), '2026-10-01'] as QueryKey;
    queryClient.setQueryData(own, { slots: [] });
    queryClient.setQueryData(other, { slots: [] });
    queryClient.setQueryData(reservationKeys.detail(ID), { id: ID, restaurantSlug: 'the-bell' });
    vi.mocked(fetchJson).mockResolvedValue({ id: ID, status: 'cancelled' } as never);

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createQueryWrapper(queryClient),
    });
    await result.current.mutateAsync({ id: ID });

    expect(invalidated(queryClient, own)).toBe(true);
    expect(invalidated(queryClient, other)).toBe(false);
  });

  it('refreshes every schedule when the restaurant is unknown', async () => {
    const queryClient = createTestQueryClient();
    const any = [...queryKeys.reservations.scheduleFor('the-bell'), '2026-10-01'] as QueryKey;
    queryClient.setQueryData(any, { slots: [] });
    vi.mocked(fetchJson).mockResolvedValue({ id: ID, status: 'cancelled' } as never);

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createQueryWrapper(queryClient),
    });
    await result.current.mutateAsync({ id: ID });

    expect(invalidated(queryClient, any)).toBe(true);
  });
});
