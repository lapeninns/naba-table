import { describe, expect, it } from 'vitest';

import {
  DUAL_SYNC_BULK_ACTION_IDS,
  buildDualSyncBulkActionIntent,
  buildDualSyncBulkActionButtons,
  isDualSyncBulkSelectAction,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncBulkActionBarDomain';

describe('dualSyncBulkActionBarDomain', () => {
  it('builds bulk action buttons in shipped order with labels, variants, and counts', () => {
    expect(
      buildDualSyncBulkActionButtons({
        writeBlocked: false,
        bulkSummary: {
          importable: 2,
          exportable: 1,
          ignorable: 3,
          selected: 4,
        },
      }),
    ).toEqual([
      {
        id: DUAL_SYNC_BULK_ACTION_IDS.importFromGoogle,
        label: 'Import',
        variant: 'outline',
        count: 2,
        disabled: false,
      },
      {
        id: DUAL_SYNC_BULK_ACTION_IDS.exportToGoogle,
        label: 'Export',
        variant: 'outline',
        count: 1,
        disabled: false,
      },
      {
        id: DUAL_SYNC_BULK_ACTION_IDS.ignore,
        label: 'Ignore',
        variant: 'outline',
        count: 3,
        disabled: false,
      },
      {
        id: DUAL_SYNC_BULK_ACTION_IDS.clear,
        label: 'Clear',
        variant: 'ghost',
        count: 4,
        disabled: false,
      },
    ]);
  });

  it('disables zero-count actions independently', () => {
    expect(
      buildDualSyncBulkActionButtons({
        writeBlocked: false,
        bulkSummary: {
          importable: 0,
          exportable: 2,
          ignorable: 0,
          selected: 1,
        },
      }).map((button) => [button.id, button.disabled]),
    ).toEqual([
      [DUAL_SYNC_BULK_ACTION_IDS.importFromGoogle, true],
      [DUAL_SYNC_BULK_ACTION_IDS.exportToGoogle, false],
      [DUAL_SYNC_BULK_ACTION_IDS.ignore, true],
      [DUAL_SYNC_BULK_ACTION_IDS.clear, false],
    ]);
  });

  it('disables every action while writes are blocked', () => {
    expect(
      buildDualSyncBulkActionButtons({
        writeBlocked: true,
        bulkSummary: {
          importable: 2,
          exportable: 2,
          ignorable: 2,
          selected: 2,
        },
      }).every((button) => button.disabled),
    ).toBe(true);
  });

  it('distinguishes selectable decision actions from clear', () => {
    expect(isDualSyncBulkSelectAction(DUAL_SYNC_BULK_ACTION_IDS.importFromGoogle)).toBe(true);
    expect(isDualSyncBulkSelectAction(DUAL_SYNC_BULK_ACTION_IDS.exportToGoogle)).toBe(true);
    expect(isDualSyncBulkSelectAction(DUAL_SYNC_BULK_ACTION_IDS.ignore)).toBe(true);
    expect(isDualSyncBulkSelectAction(DUAL_SYNC_BULK_ACTION_IDS.clear)).toBe(false);
  });

  it('builds click intents for selectable actions and clear', () => {
    expect(buildDualSyncBulkActionIntent(DUAL_SYNC_BULK_ACTION_IDS.importFromGoogle)).toEqual({
      kind: 'select',
      action: 'import_from_google',
    });
    expect(buildDualSyncBulkActionIntent(DUAL_SYNC_BULK_ACTION_IDS.exportToGoogle)).toEqual({
      kind: 'select',
      action: 'export_to_google',
    });
    expect(buildDualSyncBulkActionIntent(DUAL_SYNC_BULK_ACTION_IDS.ignore)).toEqual({
      kind: 'select',
      action: 'ignore',
    });
    expect(buildDualSyncBulkActionIntent(DUAL_SYNC_BULK_ACTION_IDS.clear)).toEqual({
      kind: 'clear',
    });
  });
});
