import {
  getDualSyncShellHeaderActionState,
  type DualSyncShellHeaderActionStateInput,
} from './dualSyncShellHeaderDomain';

export type DualSyncShellHeaderActionId =
  | 'drift'
  | 'control'
  | 'refresh'
  | 'autoExport'
  | 'publish';

export type DualSyncShellHeaderActionIcon =
  | 'filter'
  | 'pause'
  | 'play'
  | 'refresh'
  | 'zap'
  | 'send';

export interface DualSyncShellHeaderActionButtonModel {
  readonly id: DualSyncShellHeaderActionId;
  readonly label: string;
  readonly variant: 'default' | 'outline' | 'secondary';
  readonly disabled: boolean;
  readonly ariaDisabled: boolean;
  readonly icon: DualSyncShellHeaderActionIcon;
  readonly iconMotion: 'spin' | 'pulse' | null;
  readonly className?: string;
  readonly tooltip: {
    readonly enabledHint: string;
    readonly disabledHint: string;
  } | null;
}

export function getDualSyncShellHeaderActionButtonModels(
  input: DualSyncShellHeaderActionStateInput,
): ReadonlyArray<DualSyncShellHeaderActionButtonModel> {
  const actions = getDualSyncShellHeaderActionState(input);

  return [
    {
      id: 'drift',
      label: actions.drift.label,
      variant: actions.drift.variant,
      disabled: false,
      ariaDisabled: false,
      icon: 'filter',
      iconMotion: null,
      className: 'h-9 px-3',
      tooltip: null,
    },
    {
      id: 'control',
      label: actions.control.label,
      variant: actions.control.variant,
      disabled: actions.control.disabled,
      ariaDisabled: false,
      icon: input.syncPaused ? 'play' : 'pause',
      iconMotion: null,
      tooltip: {
        enabledHint: actions.control.enabledHint,
        disabledHint: actions.control.disabledHint,
      },
    },
    {
      id: 'refresh',
      label: 'Import latest Google details',
      variant: 'outline',
      disabled: actions.refresh.disabled,
      ariaDisabled: false,
      icon: 'refresh',
      iconMotion: input.refreshPending ? 'spin' : null,
      tooltip: {
        enabledHint:
          'Pull a fresh listing snapshot for the review workspace below. This does not apply draft actions or refresh only the connection card.',
        disabledHint: actions.refresh.disabledHint,
      },
    },
    {
      id: 'autoExport',
      label: actions.autoExport.label,
      variant: 'outline',
      disabled: actions.autoExport.disabled,
      ariaDisabled: actions.autoExport.disabled,
      icon: 'zap',
      iconMotion: input.autoExportPending ? 'pulse' : null,
      tooltip: {
        enabledHint: actions.autoExport.enabledHint,
        disabledHint: actions.autoExport.disabledHint,
      },
    },
    {
      id: 'publish',
      label: actions.publish.label,
      variant: 'default',
      disabled: actions.publish.disabled,
      ariaDisabled: actions.publish.disabled,
      icon: 'send',
      iconMotion: null,
      tooltip: {
        enabledHint: actions.publish.enabledHint,
        disabledHint: actions.publish.disabledHint,
      },
    },
  ];
}
