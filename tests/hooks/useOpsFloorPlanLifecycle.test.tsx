import { act, renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsFloorPlanLifecycle } from '@src/hooks/ops/useOpsFloorPlanLifecycle';

const actions = vi.hoisted(() => ({
  checkIn: { mutateAsync: vi.fn() },
  checkOut: { mutateAsync: vi.fn() },
  markNoShow: { mutateAsync: vi.fn() },
  undoNoShow: { mutateAsync: vi.fn() },
}));

const offline = vi.hoisted(() => ({ value: null as { isOffline: boolean } | null }));

vi.mock('@/hooks/ops/useOpsBookingStatusActions', () => ({
  useOpsBookingLifecycleActions: () => actions,
}));

vi.mock('@/contexts/booking-offline-queue', () => ({
  useBookingOfflineQueue: () => offline.value,
}));

function setup() {
  const queryClient = createTestQueryClient();
  return renderHook(() => useOpsFloorPlanLifecycle({ restaurantId: 'rest-1', date: null }), {
    wrapper: createQueryWrapper(queryClient),
  });
}

beforeEach(() => {
  Object.values(actions).forEach((a) => a.mutateAsync.mockReset().mockResolvedValue(undefined));
  offline.value = null;
});

describe('useOpsFloorPlanLifecycle', () => {
  it('reports done and passes the restaurant, booking and date through', async () => {
    const { result } = setup();
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.run('check-in', 'b1');
    });
    expect(outcome).toBe('done');
    expect(actions.checkIn.mutateAsync).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      bookingId: 'b1',
      targetDate: null,
    });
    expect(result.current.busy).toEqual({});
  });

  it('reports queued when offline so the UI does not claim it happened', async () => {
    offline.value = { isOffline: true };
    const { result } = setup();
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.run('complete', 'b1');
    });
    expect(outcome).toBe('queued');
    expect(actions.checkOut.mutateAsync).toHaveBeenCalled();
  });

  it('clears the busy flag when the action fails', async () => {
    actions.markNoShow.mutateAsync.mockRejectedValue(new Error('boom'));
    const { result } = setup();
    await act(async () => {
      await expect(result.current.run('no-show', 'b1')).rejects.toThrow('boom');
    });
    expect(result.current.busy).toEqual({});
  });
});
