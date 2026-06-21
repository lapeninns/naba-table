export interface DualSyncShellHeaderActionStateInput {
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly showDriftOnly: boolean;
  readonly controlPending: boolean;
  readonly refreshPending: boolean;
  readonly autoExportPending: boolean;
  readonly publishPending: boolean;
  readonly previewPublishPending: boolean;
  readonly canSubmit: boolean;
  readonly autoExportable: number;
  readonly decisionCount: number;
}

export interface DualSyncShellHeaderActionState {
  readonly drift: {
    readonly label: string;
    readonly variant: 'secondary' | 'outline';
  };
  readonly control: {
    readonly label: string;
    readonly variant: 'default' | 'outline';
    readonly disabled: boolean;
    readonly enabledHint: string;
    readonly disabledHint: string;
  };
  readonly refresh: {
    readonly disabled: boolean;
    readonly disabledHint: string;
  };
  readonly autoExport: {
    readonly label: string;
    readonly disabled: boolean;
    readonly disabledHint: string;
    readonly enabledHint: string;
  };
  readonly publish: {
    readonly label: string;
    readonly disabled: boolean;
    readonly disabledHint: string;
    readonly enabledHint: string;
  };
}

export function getDualSyncShellHeaderActionState(
  input: DualSyncShellHeaderActionStateInput,
): DualSyncShellHeaderActionState {
  const autoExportDisabled =
    input.syncPaused || input.autoExportable === 0 || input.autoExportPending;
  const publishDisabled = !input.canSubmit;

  return {
    drift: {
      label: input.showDriftOnly ? 'Differences only' : 'All fields',
      variant: input.showDriftOnly ? 'secondary' : 'outline',
    },
    control: {
      label: input.controlPending ? 'Updating...' : input.syncPaused ? 'Resume sync' : 'Pause sync',
      variant: input.syncPaused ? 'default' : 'outline',
      disabled: input.controlPending,
      enabledHint: input.syncPaused
        ? 'Turn writes back on so you can refresh data, edit field actions, and publish.'
        : 'Stop refresh, publish, and field actions while you investigate. Your unsent draft choices are cleared when you pause.',
      disabledHint: 'Updating pause state...',
    },
    refresh: {
      disabled: input.syncPaused || input.refreshPending,
      disabledHint: input.syncPaused
        ? input.pauseReason
        : 'Already pulling the latest Google data...',
    },
    autoExport: {
      label: input.autoExportPending
        ? 'Running...'
        : `Automatically publish approved changes ${
            input.autoExportable > 0 ? `(${input.autoExportable})` : ''
          }`.trim(),
      disabled: autoExportDisabled,
      disabledHint: input.syncPaused
        ? input.pauseReason
        : input.autoExportPending
          ? 'Automatic publishing is running...'
          : 'Nothing is queued to push to Google yet.',
      enabledHint: `Send ${input.autoExportable} queued Google update${
        input.autoExportable === 1 ? '' : 's'
      } that are ready to publish. Use after reviewing changes when work was queued.`,
    },
    publish: {
      label: input.publishPending
        ? 'Publishing...'
        : `Review and publish ${input.decisionCount > 0 ? `(${input.decisionCount})` : ''}`.trim(),
      disabled: publishDisabled,
      enabledHint:
        'Preview your choices, then apply the Import from Google, Send to Google, or Ignore decisions you selected.',
      disabledHint:
        input.publishPending || input.previewPublishPending
          ? 'Finish the running publish or preview first.'
          : input.syncPaused
            ? input.pauseReason
            : 'Choose Import from Google, Send to Google, or Ignore on at least one field.',
    },
  };
}
