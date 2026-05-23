import type { DualSyncSectionBulkSummary } from './dualSyncWorkspaceDecisionDomain';
import type { DualSyncDecisionAction } from '@/server/dual-sync';

export const DUAL_SYNC_BULK_ACTION_IDS = {
  importFromGoogle: 'import_from_google',
  exportToGoogle: 'export_to_google',
  ignore: 'ignore',
  clear: 'clear',
} as const;

export type DualSyncBulkSelectAction = Extract<
  DualSyncDecisionAction,
  'import_from_google' | 'export_to_google' | 'ignore'
>;

export type DualSyncBulkActionId =
  | DualSyncBulkSelectAction
  | typeof DUAL_SYNC_BULK_ACTION_IDS.clear;

type DualSyncBulkActionVariant = 'outline' | 'ghost';

interface BuildDualSyncBulkActionButtonsInput {
  readonly bulkSummary: DualSyncSectionBulkSummary;
  readonly writeBlocked: boolean;
}

interface DualSyncBulkActionButtonDefinition {
  readonly id: DualSyncBulkActionId;
  readonly label: string;
  readonly variant: DualSyncBulkActionVariant;
}

export interface DualSyncBulkActionButtonModel extends DualSyncBulkActionButtonDefinition {
  readonly count: number;
  readonly disabled: boolean;
}

export type DualSyncBulkActionIntent =
  | {
      readonly kind: 'select';
      readonly action: DualSyncBulkSelectAction;
    }
  | {
      readonly kind: 'clear';
    };

const DUAL_SYNC_BULK_ACTION_BUTTON_DEFINITIONS: ReadonlyArray<DualSyncBulkActionButtonDefinition> =
  [
    {
      id: DUAL_SYNC_BULK_ACTION_IDS.importFromGoogle,
      label: 'Import',
      variant: 'outline',
    },
    {
      id: DUAL_SYNC_BULK_ACTION_IDS.exportToGoogle,
      label: 'Export',
      variant: 'outline',
    },
    {
      id: DUAL_SYNC_BULK_ACTION_IDS.ignore,
      label: 'Ignore',
      variant: 'outline',
    },
    {
      id: DUAL_SYNC_BULK_ACTION_IDS.clear,
      label: 'Clear',
      variant: 'ghost',
    },
  ];

export function buildDualSyncBulkActionButtons({
  bulkSummary,
  writeBlocked,
}: BuildDualSyncBulkActionButtonsInput): ReadonlyArray<DualSyncBulkActionButtonModel> {
  return DUAL_SYNC_BULK_ACTION_BUTTON_DEFINITIONS.map((definition) => {
    const count = getDualSyncBulkActionCount(definition.id, bulkSummary);
    return {
      ...definition,
      count,
      disabled: writeBlocked || count === 0,
    };
  });
}

export function isDualSyncBulkSelectAction(
  actionId: DualSyncBulkActionId,
): actionId is DualSyncBulkSelectAction {
  return actionId !== DUAL_SYNC_BULK_ACTION_IDS.clear;
}

export function buildDualSyncBulkActionIntent(
  actionId: DualSyncBulkActionId,
): DualSyncBulkActionIntent {
  if (isDualSyncBulkSelectAction(actionId)) {
    return {
      kind: 'select',
      action: actionId,
    };
  }

  return {
    kind: 'clear',
  };
}

function getDualSyncBulkActionCount(
  actionId: DualSyncBulkActionId,
  bulkSummary: DualSyncSectionBulkSummary,
): number {
  switch (actionId) {
    case DUAL_SYNC_BULK_ACTION_IDS.importFromGoogle:
      return bulkSummary.importable;
    case DUAL_SYNC_BULK_ACTION_IDS.exportToGoogle:
      return bulkSummary.exportable;
    case DUAL_SYNC_BULK_ACTION_IDS.ignore:
      return bulkSummary.ignorable;
    case DUAL_SYNC_BULK_ACTION_IDS.clear:
      return bulkSummary.selected;
  }
}
