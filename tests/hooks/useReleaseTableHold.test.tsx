import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { useReleaseTableHold } from '@src/hooks/ops/useReleaseTableHold';

import type { ReactNode } from 'react';

const releaseTableHoldMock = vi.hoisted(() => vi.fn());
const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));

vi.mock('@/services/ops/table-holds', () => ({ releaseTableHold: releaseTableHoldMock }));
vi.mock('sonner', () => ({ toast: toastMocks }));

const RESTAURANT_A = 'rest-a';
const RESTAURANT_B = 'rest-b';
const HOLD_ID = 'hold-1';

const keys = {
  timelineToday: queryKeys.opsTables.timeline(RESTAURANT_A, { date: '2026-09-26' }),
  timelineOther: queryKeys.opsTables.timeline(RESTAURANT_A, { date: '2026-09-27', zoneId: 'z' }),
  tables: queryKeys.opsTables.list(RESTAURANT_A),
  summary: queryKeys.opsDashboard.summary(RESTAURANT_A, null),
  otherTimeline: queryKeys.opsTables.timeline(RESTAURANT_B, { date: '2026-09-26' }),
};

function render(queryClient: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useReleaseTableHold(RESTAURANT_A), { wrapper });
}

function invalidated(queryClient: QueryClient, key: readonly unknown[]) {
  return queryClient.getQueryState(key)?.isInvalidated ?? false;
}

describe('useReleaseTableHold', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createAppQueryClient();
    for (const key of Object.values(keys)) queryClient.setQueryData(key, { seeded: true });
  });

  it('refetches only this restaurant timeline and confirms with one toast', async () => {
    releaseTableHoldMock.mockResolvedValue({
      holdId: HOLD_ID,
      released: true,
      alreadyReleased: false,
    });
    const { result } = render(queryClient);

    await act(async () => {
      await result.current.mutateAsync({ restaurantId: RESTAURANT_A, holdId: HOLD_ID });
    });

    expect(releaseTableHoldMock).toHaveBeenCalledWith(
      { restaurantId: RESTAURANT_A, holdId: HOLD_ID },
      expect.anything(),
    );
    expect(invalidated(queryClient, keys.timelineToday)).toBe(true);
    expect(invalidated(queryClient, keys.timelineOther)).toBe(true);
    expect(invalidated(queryClient, keys.tables)).toBe(false);
    expect(invalidated(queryClient, keys.summary)).toBe(false);
    expect(invalidated(queryClient, keys.otherTimeline)).toBe(false);
    expect(toastMocks.success).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).toHaveBeenCalledWith('Hold released. Those tables are free again.');
  });

  it('says so when the hold had already ended', async () => {
    releaseTableHoldMock.mockResolvedValue({
      holdId: HOLD_ID,
      released: true,
      alreadyReleased: true,
    });
    const { result } = render(queryClient);

    await act(async () => {
      await result.current.mutateAsync({ restaurantId: RESTAURANT_A, holdId: HOLD_ID });
    });

    expect(toastMocks.success).toHaveBeenCalledWith(
      'That hold had already ended. The timeline is up to date.',
    );
    expect(invalidated(queryClient, keys.timelineToday)).toBe(true);
  });

  it('leaves errors to the caller: no toast, no invalidation', async () => {
    releaseTableHoldMock.mockRejectedValue(
      new HttpError({ message: 'no', status: 403, code: 'FORBIDDEN' }),
    );
    const { result } = render(queryClient);

    await act(async () => {
      await result.current
        .mutateAsync({ restaurantId: RESTAURANT_A, holdId: HOLD_ID })
        .catch(() => undefined);
    });

    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(invalidated(queryClient, keys.timelineToday)).toBe(false);
    await waitFor(() => expect(result.current.error).toBeInstanceOf(HttpError));
  });
});
