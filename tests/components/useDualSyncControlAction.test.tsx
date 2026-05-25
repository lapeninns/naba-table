import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDualSyncControlAction } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncControlAction';

function renderControlAction({
  clearPublishPreview = vi.fn(),
  controlMutation = vi.fn(async () => undefined),
  setDecisions = vi.fn(),
  showToast = vi.fn(),
  syncPaused = false,
} = {}) {
  const workspace = {
    controlMutation: {
      mutateAsync: controlMutation,
    },
    setDecisions,
  };

  return {
    clearPublishPreview,
    controlMutation,
    setDecisions,
    showToast,
    ...renderHook(() =>
      useDualSyncControlAction({
        workspace,
        syncPaused,
        clearPublishPreview,
        showToast,
      }),
    ),
  };
}

describe('useDualSyncControlAction', () => {
  it('pauses dual-sync, clears local decisions, and clears the publish preview', async () => {
    const { clearPublishPreview, controlMutation, result, setDecisions, showToast } =
      renderControlAction({ syncPaused: false });

    await act(async () => result.current.onClickToggleControl());

    expect(controlMutation).toHaveBeenCalledWith({
      reason: 'Paused from dual-sync settings.',
      syncPaused: true,
    });
    expect(setDecisions).toHaveBeenCalledWith({});
    expect(clearPublishPreview).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Dual-sync is paused for this restaurant.',
    });
  });

  it('resumes dual-sync without clearing local decisions or publish preview', async () => {
    const { clearPublishPreview, controlMutation, result, setDecisions, showToast } =
      renderControlAction({ syncPaused: true });

    await act(async () => result.current.onClickToggleControl());

    expect(controlMutation).toHaveBeenCalledWith({
      reason: null,
      syncPaused: false,
    });
    expect(setDecisions).not.toHaveBeenCalled();
    expect(clearPublishPreview).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Dual-sync is active for this restaurant.',
    });
  });

  it('reports control mutation failures with the normalized message', async () => {
    const controlMutation = vi.fn(async () => {
      throw new Error('Control update broke');
    });
    const { clearPublishPreview, result, setDecisions, showToast } = renderControlAction({
      controlMutation,
      syncPaused: false,
    });

    await act(async () => result.current.onClickToggleControl());

    expect(setDecisions).not.toHaveBeenCalled();
    expect(clearPublishPreview).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Control update broke',
    });
  });
});
