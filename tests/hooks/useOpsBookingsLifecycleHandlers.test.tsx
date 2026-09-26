import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useOpsBookingsLifecycleHandlers,
  type UseOpsBookingsLifecycleHandlersParams,
} from '@src/hooks/ops/useOpsBookingsLifecycleHandlers';

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

const restaurantId = 'rest-1';
const targetDate = '2026-07-11';

function setup(overrides: Partial<UseOpsBookingsLifecycleHandlersParams> = {}) {
  const params: UseOpsBookingsLifecycleHandlersParams = {
    restaurantId,
    targetDate,
    getBookingLabel: () => 'Guest One',
    ...overrides,
  };
  return renderHook(() => useOpsBookingsLifecycleHandlers(params));
}

beforeEach(() => {
  lifecycle.pendingActions = {};
  lifecycle.run.mockResolvedValue({ status: 'done', result: {} });
});

describe('useOpsBookingsLifecycleHandlers', () => {
  it('@contract every handler is a no-op without a restaurant id', async () => {
    const { result } = setup({ restaurantId: null });

    await act(async () => {
      await result.current.onCheckIn('b1');
      await result.current.onCheckOut('b1');
      await result.current.onMarkNoShow('b1');
      await result.current.onUndoNoShow('b1');
    });

    expect(lifecycle.run).not.toHaveBeenCalled();
  });

  it('@contract routes each action through the canonical lifecycle hook with the list label', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.onCheckIn('b1');
      await result.current.onCheckOut('b1');
      await result.current.onMarkNoShow('b1', {
        performedAt: '2026-07-11T19:00:00.000Z',
        reason: 'late',
      });
      await result.current.onUndoNoShow('b1');
    });

    expect(lifecycle.run.mock.calls.map(([variables]) => variables)).toEqual([
      { action: 'check-in', restaurantId, bookingId: 'b1', targetDate },
      { action: 'check-out', restaurantId, bookingId: 'b1', targetDate },
      {
        action: 'no-show',
        restaurantId,
        bookingId: 'b1',
        targetDate,
        performedAt: '2026-07-11T19:00:00.000Z',
        reason: 'late',
      },
      { action: 'undo-no-show', restaurantId, bookingId: 'b1', targetDate, reason: null },
    ]);
    const options = lifecycle.options as { getBookingLabel: (id: string) => string };
    expect(options.getBookingLabel('b1')).toBe('Guest One');
  });

  it('@contract resolves when the action fails (feedback is the hook’s job)', async () => {
    lifecycle.run.mockResolvedValue({ status: 'failed', error: new Error('boom') });
    const { result } = setup();

    await expect(result.current.onCheckIn('b1')).resolves.toBeUndefined();
  });

  it('@contract exposes per-booking pending actions from the mutation cache', () => {
    lifecycle.pendingActions = {
      b1: { bookingId: 'b1', action: 'check-in', snapshot: null },
      b2: { bookingId: 'b2', action: 'no-show', snapshot: null },
    };
    const { result } = setup();

    expect(result.current.pendingActionsByBookingId).toEqual({ b1: 'check-in', b2: 'no-show' });
  });
});
