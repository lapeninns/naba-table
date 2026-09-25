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
  decisions = {} as Record<
    string,
    { action: 'export_to_google' | 'import_from_google' | 'ignore' }
  >,
  previewPublishPending = false,
  publishPending = false,
  exactPublishPending = false,
  stateData = makeState(),
} = {}) {
  return {
    decisions,
    exactPublishMutation: {
      isPending: exactPublishPending,
    },
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
      decisions: { 'profile.name': { action: 'export_to_google' } },
      stateData: makeState({ syncPaused: true, pauseReason: 'Maintenance.' }),
    });
    mocks.useDualSyncWorkspace.mockReturnValue(workspace);

    const { result } = renderHook(() =>
      useDualSyncShellController({
        restaurantId: 'restaurant-1',
        sections: ['profile'],
      }),
    );

    expect(mocks.useDualSyncWorkspace).toHaveBeenCalledWith({
      restaurantId: 'restaurant-1',
      sections: ['profile'],
    });
    expect(mocks.useDualSyncShellActions).toHaveBeenCalledWith({
      restaurantId: 'restaurant-1',
      workspace,
      syncPaused: true,
      pauseReason: 'Maintenance.',
      canPublish: false,
      canImport: false,
    });
    expect(result.current.workspace).toBe(workspace);
    expect(result.current.shellViewState.syncPaused).toBe(true);
    expect(result.current.shellViewState.canPublish).toBe(false);
  });

  it('derives publish and import readiness separately and switches the field filter', () => {
    const workspace = makeWorkspace({
      decisions: {
        'profile.name': { action: 'export_to_google' },
        'profile.phone': { action: 'import_from_google' },
      },
    });
    mocks.useDualSyncWorkspace.mockReturnValue(workspace);

    const { result } = renderHook(() =>
      useDualSyncShellController({ restaurantId: 'restaurant-1' }),
    );

    expect(result.current.shellViewState.canPublish).toBe(true);
    expect(result.current.shellViewState.canImport).toBe(true);
    expect(result.current.shellViewState.decisionSummary).toEqual({
      toSend: 1,
      toImport: 1,
      ignored: 0,
    });
    expect(result.current.showDriftOnly).toBe(true);

    act(() => result.current.setShowDriftOnly(false));

    expect(result.current.showDriftOnly).toBe(false);
  });

  it('blocks both actions while any publish is running', () => {
    mocks.useDualSyncWorkspace.mockReturnValue(
      makeWorkspace({
        decisions: { 'profile.name': { action: 'export_to_google' } },
        exactPublishPending: true,
      }),
    );

    const { result } = renderHook(() =>
      useDualSyncShellController({ restaurantId: 'restaurant-1' }),
    );

    expect(result.current.shellViewState.writeBlocked).toBe(true);
    expect(result.current.shellViewState.canPublish).toBe(false);
  });
});
