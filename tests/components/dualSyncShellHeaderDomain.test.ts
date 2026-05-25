import { describe, expect, it } from 'vitest';

import { getDualSyncShellHeaderActionButtonModels } from '@/components/features/restaurant-settings/dual-sync/dualSyncShellHeaderActionButtonDomain';
import { getDualSyncShellHeaderActionState } from '@/components/features/restaurant-settings/dual-sync/dualSyncShellHeaderDomain';

function activeActionInput() {
  return {
    syncPaused: false,
    pauseReason: 'Paused.',
    showDriftOnly: true,
    controlPending: false,
    refreshPending: false,
    autoExportPending: false,
    publishPending: false,
    previewPublishPending: false,
    canSubmit: true,
    autoExportable: 2,
    decisionCount: 3,
  };
}

describe('dualSyncShellHeaderDomain', () => {
  it('builds action state for an active workspace with queued auto exports', () => {
    expect(getDualSyncShellHeaderActionState(activeActionInput())).toMatchObject({
      drift: { label: 'Differences only', variant: 'secondary' },
      control: { label: 'Pause sync', variant: 'outline', disabled: false },
      refresh: { disabled: false },
      autoExport: {
        label: 'Automatically publish approved changes (2)',
        disabled: false,
      },
      publish: {
        label: 'Review and publish (3)',
        disabled: false,
      },
    });
  });

  it('builds render-ready header action button models', () => {
    expect(getDualSyncShellHeaderActionButtonModels(activeActionInput())).toEqual([
      expect.objectContaining({
        id: 'drift',
        label: 'Differences only',
        variant: 'secondary',
        disabled: false,
        ariaDisabled: false,
        icon: 'filter',
        iconMotion: null,
        tooltip: null,
      }),
      expect.objectContaining({
        id: 'control',
        label: 'Pause sync',
        variant: 'outline',
        disabled: false,
        icon: 'pause',
        tooltip: expect.objectContaining({
          enabledHint: expect.stringContaining('Stop refresh'),
        }),
      }),
      expect.objectContaining({
        id: 'refresh',
        label: 'Import latest Google details',
        variant: 'outline',
        disabled: false,
        icon: 'refresh',
        iconMotion: null,
      }),
      expect.objectContaining({
        id: 'autoExport',
        label: 'Automatically publish approved changes (2)',
        variant: 'outline',
        disabled: false,
        ariaDisabled: false,
        icon: 'zap',
      }),
      expect.objectContaining({
        id: 'publish',
        label: 'Review and publish (3)',
        variant: 'default',
        disabled: false,
        ariaDisabled: false,
        icon: 'send',
      }),
    ]);
  });

  it('marks pending header action icons and paused control icon', () => {
    const models = getDualSyncShellHeaderActionButtonModels({
      ...activeActionInput(),
      syncPaused: true,
      refreshPending: true,
      autoExportPending: true,
      canSubmit: false,
      autoExportable: 0,
    });

    expect(models.find((model) => model.id === 'control')).toMatchObject({
      icon: 'play',
    });
    expect(models.find((model) => model.id === 'refresh')).toMatchObject({
      disabled: true,
      iconMotion: 'spin',
    });
    expect(models.find((model) => model.id === 'autoExport')).toMatchObject({
      disabled: true,
      ariaDisabled: true,
      iconMotion: 'pulse',
    });
    expect(models.find((model) => model.id === 'publish')).toMatchObject({
      disabled: true,
      ariaDisabled: true,
    });
  });

  it('builds disabled action state for paused and pending workspaces', () => {
    const state = getDualSyncShellHeaderActionState({
      syncPaused: true,
      pauseReason: 'Maintenance window.',
      showDriftOnly: false,
      controlPending: true,
      refreshPending: true,
      autoExportPending: true,
      publishPending: false,
      previewPublishPending: true,
      canSubmit: false,
      autoExportable: 0,
      decisionCount: 0,
    });

    expect(state.drift).toEqual({ label: 'All fields', variant: 'outline' });
    expect(state.control).toMatchObject({
      label: 'Updating...',
      variant: 'default',
      disabled: true,
    });
    expect(state.refresh).toMatchObject({
      disabled: true,
      disabledHint: 'Maintenance window.',
    });
    expect(state.autoExport).toMatchObject({
      label: 'Running...',
      disabled: true,
      disabledHint: 'Maintenance window.',
    });
    expect(state.publish).toMatchObject({
      label: 'Review and publish',
      disabled: true,
      disabledHint: 'Finish the running publish or preview first.',
    });
  });
});
