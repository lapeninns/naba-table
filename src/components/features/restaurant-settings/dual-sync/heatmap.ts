/**
 * Phase 3q of the unified dual-sync engine.
 *
 * Pure aggregator that turns the per-field summary returned by
 * `GET /dual-sync/state` into a compact heatmap structure used by the
 * shell header (whole-restaurant) and per-section accordions.
 *
 * The heatmap collapses the 11 raw field states into 4 buckets that
 * map to traffic-light tones, plus an "ignored" / "unsupported" bucket
 * the operator typically does not want to action.
 */

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export type DualSyncHeatmapBucket =
  | 'in_sync'
  | 'drift'
  | 'conflict'
  | 'pending'
  | 'failed'
  | 'inactive';

export interface DualSyncHeatmapCounts {
  readonly total: number;
  readonly in_sync: number;
  readonly drift: number;
  readonly conflict: number;
  readonly pending: number;
  readonly failed: number;
  readonly inactive: number;
  /** Convenience flag: any non in_sync / inactive bucket is non-zero. */
  readonly hasActionableState: boolean;
}

export const HEATMAP_BUCKETS: ReadonlyArray<DualSyncHeatmapBucket> = [
  'in_sync',
  'drift',
  'conflict',
  'pending',
  'failed',
  'inactive',
];

export const HEATMAP_BUCKET_LABEL: Record<DualSyncHeatmapBucket, string> = {
  in_sync: 'In sync',
  drift: 'Drifted',
  conflict: 'Conflict',
  pending: 'Pending',
  failed: 'Failed',
  inactive: 'Inactive',
};

export const HEATMAP_BUCKET_TONE: Record<DualSyncHeatmapBucket, string> = {
  in_sync: 'bg-emerald-500',
  drift: 'bg-amber-500',
  conflict: 'bg-orange-500',
  pending: 'bg-sky-500',
  failed: 'bg-destructive',
  inactive: 'bg-muted-foreground/40',
};

const STATE_TO_BUCKET: Record<string, DualSyncHeatmapBucket> = {
  in_sync: 'in_sync',
  core_dirty: 'drift',
  gbp_dirty: 'drift',
  drifted: 'drift',
  conflict: 'conflict',
  pending_import: 'pending',
  pending_export: 'pending',
  import_failed: 'failed',
  export_failed: 'failed',
  ignored: 'inactive',
  unsupported: 'inactive',
};

export function bucketForFieldState(state: string | null | undefined): DualSyncHeatmapBucket {
  if (!state) return 'inactive';
  return STATE_TO_BUCKET[state] ?? 'inactive';
}

export function summarizeFieldsToHeatmap(
  fields: ReadonlyArray<DualSyncFieldSummary>,
): DualSyncHeatmapCounts {
  let in_sync = 0;
  let drift = 0;
  let conflict = 0;
  let pending = 0;
  let failed = 0;
  let inactive = 0;
  for (const field of fields) {
    switch (bucketForFieldState(field.state)) {
      case 'in_sync':
        in_sync += 1;
        break;
      case 'drift':
        drift += 1;
        break;
      case 'conflict':
        conflict += 1;
        break;
      case 'pending':
        pending += 1;
        break;
      case 'failed':
        failed += 1;
        break;
      case 'inactive':
      default:
        inactive += 1;
    }
  }
  const total = fields.length;
  return {
    total,
    in_sync,
    drift,
    conflict,
    pending,
    failed,
    inactive,
    hasActionableState:
      drift > 0 || conflict > 0 || pending > 0 || failed > 0,
  };
}
