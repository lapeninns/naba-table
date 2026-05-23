import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DUAL_SYNC_LAZY_PANEL_IDS } from '@/components/features/restaurant-settings/dual-sync/dualSyncLazyPanelsDomain';
import { useDualSyncLazyPanelsController } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncLazyPanelsController';

function makeWorkspace({
  showOperationalHealth = false,
  showOperations = false,
  showPendingCandidates = false,
  showPublishJobs = false,
  showQueueJobs = false,
} = {}) {
  return {
    setShowOperationalHealth: vi.fn(),
    setShowOperations: vi.fn(),
    setShowPendingCandidates: vi.fn(),
    setShowPublishJobs: vi.fn(),
    setShowQueueJobs: vi.fn(),
    showOperationalHealth,
    showOperations,
    showPendingCandidates,
    showPublishJobs,
    showQueueJobs,
  };
}

describe('useDualSyncLazyPanelsController', () => {
  it('derives lazy panel states from workspace activation flags', () => {
    let workspace = makeWorkspace({
      showOperationalHealth: true,
      showPublishJobs: true,
    });
    const { rerender, result } = renderHook(() => useDualSyncLazyPanelsController(workspace));

    expect(result.current.panels.map((panel) => [panel.id, panel.isActive])).toEqual([
      ['metrics', true],
      ['pendingCandidates', false],
      ['queueJobs', false],
      ['publishes', true],
      ['operations', false],
    ]);

    workspace = makeWorkspace({
      showOperations: true,
      showPendingCandidates: true,
      showQueueJobs: true,
    });
    rerender();

    expect(result.current.panels.map((panel) => [panel.id, panel.isActive])).toEqual([
      ['metrics', false],
      ['pendingCandidates', true],
      ['queueJobs', true],
      ['publishes', false],
      ['operations', true],
    ]);
  });

  it('activates each lazy panel through the matching workspace setter', () => {
    const workspace = makeWorkspace();
    const { result } = renderHook(() => useDualSyncLazyPanelsController(workspace));

    act(() => result.current.activatePanel(DUAL_SYNC_LAZY_PANEL_IDS.metrics));
    expect(workspace.setShowOperationalHealth).toHaveBeenCalledWith(true);
    expect(workspace.setShowPendingCandidates).not.toHaveBeenCalled();
    expect(workspace.setShowQueueJobs).not.toHaveBeenCalled();
    expect(workspace.setShowPublishJobs).not.toHaveBeenCalled();
    expect(workspace.setShowOperations).not.toHaveBeenCalled();

    vi.clearAllMocks();

    act(() => result.current.activatePanel(DUAL_SYNC_LAZY_PANEL_IDS.pendingCandidates));
    expect(workspace.setShowPendingCandidates).toHaveBeenCalledWith(true);
    expect(workspace.setShowOperationalHealth).not.toHaveBeenCalled();
    expect(workspace.setShowQueueJobs).not.toHaveBeenCalled();
    expect(workspace.setShowPublishJobs).not.toHaveBeenCalled();
    expect(workspace.setShowOperations).not.toHaveBeenCalled();

    vi.clearAllMocks();

    act(() => result.current.activatePanel(DUAL_SYNC_LAZY_PANEL_IDS.queueJobs));
    expect(workspace.setShowQueueJobs).toHaveBeenCalledWith(true);
    expect(workspace.setShowOperationalHealth).not.toHaveBeenCalled();
    expect(workspace.setShowPendingCandidates).not.toHaveBeenCalled();
    expect(workspace.setShowPublishJobs).not.toHaveBeenCalled();
    expect(workspace.setShowOperations).not.toHaveBeenCalled();

    vi.clearAllMocks();

    act(() => result.current.activatePanel(DUAL_SYNC_LAZY_PANEL_IDS.publishes));
    expect(workspace.setShowPublishJobs).toHaveBeenCalledWith(true);
    expect(workspace.setShowOperationalHealth).not.toHaveBeenCalled();
    expect(workspace.setShowPendingCandidates).not.toHaveBeenCalled();
    expect(workspace.setShowQueueJobs).not.toHaveBeenCalled();
    expect(workspace.setShowOperations).not.toHaveBeenCalled();

    vi.clearAllMocks();

    act(() => result.current.activatePanel(DUAL_SYNC_LAZY_PANEL_IDS.operations));
    expect(workspace.setShowOperations).toHaveBeenCalledWith(true);
    expect(workspace.setShowOperationalHealth).not.toHaveBeenCalled();
    expect(workspace.setShowPendingCandidates).not.toHaveBeenCalled();
    expect(workspace.setShowQueueJobs).not.toHaveBeenCalled();
    expect(workspace.setShowPublishJobs).not.toHaveBeenCalled();
  });
});
