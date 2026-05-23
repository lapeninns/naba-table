import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDualSyncShellController } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncShellController';

const mocks = vi.hoisted(() => ({
  useDualSyncShellActions: vi.fn(),
  useDualSyncWorkspace: vi.fn(),
}));

vi.mock(
  '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncShellActions',
  () => ({
    useDualSyncShellActions: mocks.useDualSyncShellActions,
  }),
);

vi.mock('@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspace', () => ({
  useDualSyncWorkspace: mocks.useDualSyncWorkspace,
}));

function makeState({
  syncPaused = false,
  pauseReason = null,
}: {
  readonly syncPaused?: boolean;
  readonly pauseReason?: string | null;
} = {}) {
  return {
    fields: [],
    lastSnapshot: null,
    outboundQueue: {
      autoExportable: 0,
      missingBaseline: 0,
      totalOpen: 0,
      lastQueuedAt: null,
    },
    control: {
      syncPaused,
      pauseReason,
    },
  };
}

function makeWorkspace({
  decisionCount = 0,
  previewPublishPending = false,
  publishPending = false,
  stateData = makeState(),
} = {}) {
  return {
    decisionCount,
    previewPublishMutation: {
      isPending: previewPublishPending,
    },
    publishMutation: {
      isPending: publishPending,
    },
    stateQuery: {
      data: stateData,
    },
  };
}

beforeEach(() => {
  mocks.useDualSyncShellActions.mockReset();
  mocks.useDualSyncWorkspace.mockReset();
  mocks.useDualSyncShellActions.mockReturnValue({
    handleReconnect: vi.fn(),
    isReconnectPending: false,
    needsReauth: false,
  });
});

describe('useDualSyncShellController', () => {
  it('passes workspace args through and wires shell actions from derived view state', () => {
    const workspace = makeWorkspace({
      decisionCount: 1,
      stateData: makeState({ syncPaused: true, pauseReason: 'Maintenance.' }),
    });
    mocks.useDualSyncWorkspace.mockReturnValue(workspace);

    const { result } = renderHook(() =>
      useDualSyncShellController({
        restaurantId: 'restaurant-1',
        sections: ['profile'],
        singleOpenSections: true,
      }),
    );

    expect(mocks.useDualSyncWorkspace).toHaveBeenCalledWith({
      restaurantId: 'restaurant-1',
      sections: ['profile'],
      singleOpenSections: true,
    });
    expect(mocks.useDualSyncShellActions).toHaveBeenCalledWith({
      restaurantId: 'restaurant-1',
      workspace,
      syncPaused: true,
      pauseReason: 'Maintenance.',
      canSubmit: false,
    });
    expect(result.current.workspace).toBe(workspace);
    expect(result.current.shellViewState.syncPaused).toBe(true);
    expect(result.current.shellViewState.canSubmit).toBe(false);
  });

  it('derives active submit state and toggles drift-only visibility', () => {
    const workspace = makeWorkspace({ decisionCount: 2 });
    mocks.useDualSyncWorkspace.mockReturnValue(workspace);

    const { result } = renderHook(() =>
      useDualSyncShellController({
        restaurantId: 'restaurant-1',
        singleOpenSections: false,
      }),
    );

    expect(result.current.shellViewState.canSubmit).toBe(true);
    expect(result.current.showDriftOnly).toBe(true);

    act(() => result.current.onToggleDriftOnly());

    expect(result.current.showDriftOnly).toBe(false);
  });
});
