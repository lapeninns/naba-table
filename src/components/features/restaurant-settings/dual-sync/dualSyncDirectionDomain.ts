export type DualSyncDirection = 'import_from_google' | 'export_to_google';

export type DualSyncDirectionIconKey = 'import' | 'export';

export function getDualSyncDirectionIconKey(
  direction: DualSyncDirection,
): DualSyncDirectionIconKey {
  return direction === 'export_to_google' ? 'export' : 'import';
}

export function formatDualSyncDirectionLabel(direction: DualSyncDirection): string {
  return getDualSyncDirectionIconKey(direction) === 'export' ? 'Export' : 'Import';
}

export function formatDualSyncDirectionToken(direction: DualSyncDirection): string {
  return getDualSyncDirectionIconKey(direction);
}
