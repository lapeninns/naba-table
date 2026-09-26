import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useDualSyncExactPublishActions } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncExactPublishActions';

import type { DualSyncWorkspace } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspace';

const stateKey = ['dual-sync-state', 'restaurant-1'] as const;

describe('useDualSyncExactPublishActions refreshExpired', () => {
  it('@contract reads the refreshed state once, without aborting the fetch the refresh invalidation started', async () => {
    const queryClient = createTestQueryClient();
    const signals: AbortSignal[] = [];
    const stateFn = vi.fn(async ({ signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { version: signals.length };
    });

    const { result } = renderHook(
      () => {
        const client = useQueryClient();
        const stateQuery = useQuery({ queryKey: stateKey, queryFn: stateFn });
        const refreshMutation = useMutation({
          mutationFn: async () => ({ ok: true }),
          // Mirrors useOpsDualSync: the refresh invalidates the state without awaiting it.
          onSuccess: () => {
            void client.invalidateQueries({ queryKey: stateKey });
          },
        });
        const workspace = {
          stateQuery,
          refreshMutation,
          decisions: {},
        } as unknown as DualSyncWorkspace;
        return useDualSyncExactPublishActions({
          workspace,
          syncPaused: false,
          pauseReason: '',
          canSubmit: false,
          showToast: vi.fn(),
        });
      },
      { wrapper: createQueryWrapper(queryClient) },
    );

    await waitFor(() => expect(queryClient.getQueryData(stateKey)).toEqual({ version: 1 }));

    await act(async () => {
      result.current.onRefreshExpired();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    // One initial load plus exactly one refetch caused by the refresh invalidation.
    expect(stateFn).toHaveBeenCalledTimes(2);
    expect(signals.some((signal) => signal.aborted)).toBe(false);
  });
});
