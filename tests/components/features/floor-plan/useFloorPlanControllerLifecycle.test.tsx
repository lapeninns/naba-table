import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFloorPlanController } from '@/components/features/floor-plan/useFloorPlanController';

import { booking, snapshot } from './floorPlanFixtures';

import type { LifecycleResponse } from '@/services/ops/bookings';

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
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
  useOpsFloorPlanLayoutSave: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
