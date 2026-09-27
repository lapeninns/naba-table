import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFloorPlanController } from '@/components/features/floor-plan/useFloorPlanController';

import { booking, snapshot } from './floorPlanFixtures';

import type { LifecycleResponse } from '@/services/ops/bookings';

// Callable, like sonner's `toast(...)`, with the variants the controller uses.
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
);
const layoutSave = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
const lifecycle = vi.hoisted(() => ({ run: vi.fn() }));
const plan = vi.hoisted(() => ({ snapshot: null as unknown }));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/contexts/ops-session', () => ({
  useOpsActiveRestaurantId: () => 'rest-1',
  useOpsActiveMembership: () => null,
}));
vi.mock('@/contexts/ops-unsaved-changes', () => ({ useRegisterOpsUnsavedChanges: vi.fn() }));
vi.mock('@/hooks/ops/useOpsFloorPlan', () => ({
  useOpsFloorPlan: () => ({
    status: 'ready',
    snapshot: plan.snapshot,
    failedSources: [],
    error: null,
    refreshError: null,
    updatedAt: null,
    isRefreshing: false,
    isRealtime: false,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/hooks/ops/useOpsFloorPlanAssignments', () => ({
  toAssignmentError: vi.fn(),
  useOpsFloorPlanAssignments: () => ({
    pending: [],
    assign: vi.fn(),
    move: vi.fn(),
    unassign: vi.fn(),
  }),
}));
vi.mock('@/hooks/ops/useOpsFloorPlanLayout', () => ({
  useOpsFloorPlanLayoutSave: () => ({ mutateAsync: layoutSave.mutateAsync, isPending: false }),
}));
vi.mock('@/hooks/ops/useOpsFloorPlanLifecycle', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useOpsFloorPlanLifecycle: () => ({ run: lifecycle.run, busy: {} }) };
});

function undoResult(
  restoration: NonNullable<LifecycleResponse['tableRestoration']>['status'],
): LifecycleResponse {
  return {
    status: 'confirmed',
    checkedInAt: null,
    checkedOutAt: null,
    tableRestoration: { status: restoration, tableIds: restoration === 'restored' ? ['T1'] : [] },
  };
}

/** Marks b1 a no-show, then presses the toast's Undo. */
async function undoNoShow(restoration: Parameters<typeof undoResult>[0]) {
  lifecycle.run.mockImplementation((action: string) =>
    Promise.resolve(
      action === 'undo-no-show'
        ? { status: 'done', result: undoResult(restoration) }
        : { status: 'done', result: { status: 'no_show', checkedInAt: null, checkedOutAt: null } },
    ),
  );
  const { result } = renderHook(() => useFloorPlanController({ initialDate: null }));
  await act(async () => {
    await result.current.actions.runLifecycle('no-show', 'b1');
  });
  const [, options] = toast.success.mock.calls[0] as [string, { action: { onClick: () => void } }];
  toast.success.mockClear();
  await act(async () => {
    options.action.onClick();
    await Promise.resolve();
  });
  expect(lifecycle.run).toHaveBeenLastCalledWith('undo-no-show', 'b1');
}

beforeEach(() => {
  vi.clearAllMocks();
  plan.snapshot = snapshot({ bookings: [booking('b1', 2, '19:00', 90, 'confirmed', ['T1'])] });
});

describe('useFloorPlanController undo no-show', () => {
  it('warns that a table is needed when the undo could not restore the tables', async () => {
    await undoNoShow('unavailable');

    expect(toast.warning).toHaveBeenCalledWith(
      'No-show undone for B1. Tables were not restored, so assign a table.',
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('warns when the server could not say whether the tables were restored', async () => {
    await undoNoShow('unknown');

    expect(toast.warning).toHaveBeenCalledWith(
      'No-show undone for B1. Tables were not restored, so assign a table.',
    );
  });

  it('shows the normal success when the tables were restored', async () => {
    await undoNoShow('restored');

    expect(toast.success).toHaveBeenCalledWith('Undo no-show: B1');
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe('useFloorPlanController layout saving', () => {
  function arrangeWithOneChange() {
    const hook = renderHook(() => useFloorPlanController({ initialDate: null, surface: 'layout' }));
    act(() => hook.result.current.actions.rotateTable('T1', 15));
    expect(hook.result.current.dirtyIds).toEqual(['T1']);
    return hook;
  }

  it('confirms a full save with a sentence toast', async () => {
    layoutSave.mutateAsync.mockResolvedValue({ saved: ['T1'], failed: [] });
    const { result } = arrangeWithOneChange();

    await act(async () => {
      await result.current.actions.saveLayout();
    });

    expect(toast.success).toHaveBeenCalledWith('Layout saved. 1 table updated.');
    expect(result.current.layoutSaveFailure).toBeNull();
    expect(result.current.dirtyIds).toEqual([]);
  });

  it('reports a partial save to the save bar with a reason code, never a server message', async () => {
    layoutSave.mutateAsync.mockResolvedValue({
      saved: [],
      failed: [{ tableId: 'T1', message: 'This table was deleted.' }],
    });
    const { result } = arrangeWithOneChange();

    await act(async () => {
      await result.current.actions.saveLayout();
    });

    expect(result.current.layoutSaveFailure).toEqual({
      failedSection: '1 of 1 tables',
      saved: [],
      notAttempted: [],
      reasonCode: 'PARTIAL_SAVE',
    });
    expect(result.current.dirtyIds).toEqual(['T1']);
  });

  it('reports a failed request with its safe reason code', async () => {
    layoutSave.mutateAsync.mockRejectedValue(new Error('network down'));
    const { result } = arrangeWithOneChange();

    await act(async () => {
      await result.current.actions.saveLayout();
    });

    expect(result.current.layoutSaveFailure).toMatchObject({ failedSection: 'Layout' });
    expect(result.current.layoutSaveFailure?.reasonCode).not.toContain('network down');
  });

  it('discards with the shared "Changes discarded." toast and clears any failure', async () => {
    layoutSave.mutateAsync.mockRejectedValue(new Error('network down'));
    const { result } = arrangeWithOneChange();
    await act(async () => {
      await result.current.actions.saveLayout();
    });

    act(() => result.current.actions.discardLayout());

    expect(toast).toHaveBeenCalledWith('Changes discarded.');
    expect(result.current.dirtyIds).toEqual([]);
    expect(result.current.layoutSaveFailure).toBeNull();
  });
});
