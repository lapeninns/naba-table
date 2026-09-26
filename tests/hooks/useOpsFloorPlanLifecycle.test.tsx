import { act, renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import { useOpsFloorPlanLifecycle } from '@src/hooks/ops/useOpsFloorPlanLifecycle';

import type { PendingLifecycleAction } from '@src/hooks/ops/useBookingLifecycle';

const lifecycle = vi.hoisted(() => ({
  run: vi.fn(),
  pendingActions: {} as Record<string, PendingLifecycleAction>,
  options: undefined as unknown,
}));

vi.mock('@src/hooks/ops/useBookingLifecycle', () => ({
  useBookingLifecycle: (options: unknown) => {
    lifecycle.options = options;
    return { run: lifecycle.run, pendingActions: lifecycle.pendingActions };
  },
}));

function setup() {
  const queryClient = createTestQueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const hook = renderHook(() => useOpsFloorPlanLifecycle({ restaurantId: 'rest-1', date: null }), {
    wrapper: createQueryWrapper(queryClient),
  });
  return { ...hook, invalidate };
}

beforeEach(() => {
  lifecycle.pendingActions = {};
  lifecycle.run.mockResolvedValue({ status: 'done', result: {} });
});

describe('useOpsFloorPlanLifecycle', () => {
  it('reports done, maps complete to check-out, and revalidates only the timeline', async () => {
    const { result, invalidate } = setup();
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.run('complete', 'b1');
    });
    expect(outcome).toBe('done');
    expect(lifecycle.run).toHaveBeenCalledWith({
      action: 'check-out',
      restaurantId: 'rest-1',
      bookingId: 'b1',
      targetDate: null,
    });
    expect(lifecycle.options).toEqual({ feedback: false });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.opsTables.timelinePrefix('rest-1'),
    });
  });

  it('reports queued when offline so the UI does not claim it happened', async () => {
    lifecycle.run.mockResolvedValue({ status: 'queued' });
    const { result, invalidate } = setup();
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.run('check-in', 'b1');
    });
    expect(outcome).toBe('queued');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('rejects with the server error so the plan can show its own copy', async () => {
    lifecycle.run.mockResolvedValue({ status: 'failed', error: new Error('boom') });
    const { result } = setup();
    await act(async () => {
      await expect(result.current.run('no-show', 'b1')).rejects.toThrow('boom');
    });
  });

  it('derives busy per booking from the pending lifecycle actions', () => {
    lifecycle.pendingActions = {
      b1: { bookingId: 'b1', action: 'check-out', snapshot: null },
      b2: { bookingId: 'b2', action: 'undo-no-show', snapshot: null },
    };
    const { result } = setup();
    expect(result.current.busy).toEqual({ b1: 'complete', b2: 'undo-no-show' });
  });
});
