import { formatDualSyncFieldPreview } from '../dual-sync/dualSyncFieldValuePreviewDomain';

export function formatGbpDriftPreview(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value.trim().length === 0 ? '-' : value;
  return formatDualSyncFieldPreview(value);
}
