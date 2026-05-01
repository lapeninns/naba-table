/**
 * Phase 3q of the unified dual-sync engine.
 *
 * Compact horizontal heatmap rendering the proportion of fields per
 * bucket as colored segments. Used in the shell header for the whole
 * restaurant, and inside each section accordion for that section's
 * fields.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import {
  HEATMAP_BUCKETS,
  HEATMAP_BUCKET_LABEL,
  HEATMAP_BUCKET_TONE,
  type DualSyncHeatmapBucket,
  type DualSyncHeatmapCounts,
} from './heatmap';

export interface DualSyncHeatmapProps {
  readonly counts: DualSyncHeatmapCounts;
  /** Inline width hint. Defaults to 100% of container. */
  readonly className?: string;
  /** When true, render compact inline counts next to the bar. */
  readonly showLabels?: boolean;
}

export function DualSyncHeatmap({ counts, className, showLabels = true }: DualSyncHeatmapProps) {
  if (counts.total === 0) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground',
          className,
        )}
      >
        No fields
      </Badge>
    );
  }
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="flex h-2 w-32 overflow-hidden rounded-sm border border-border/50"
        role="img"
        aria-label={`Field state breakdown: ${HEATMAP_BUCKETS.map(
          (b) => `${HEATMAP_BUCKET_LABEL[b]} ${counts[b]}`,
        ).join(', ')}`}
      >
        {HEATMAP_BUCKETS.map((bucket) => {
          const value = counts[bucket];
          if (value === 0) return null;
          const widthPct = (value / counts.total) * 100;
          return (
            <div
              key={bucket}
              className={cn('h-full', HEATMAP_BUCKET_TONE[bucket])}
              style={{ width: `${widthPct}%` }}
              title={`${HEATMAP_BUCKET_LABEL[bucket]}: ${value}`}
              data-bucket={bucket}
            />
          );
        })}
      </div>
      {showLabels ? <HeatmapLegend counts={counts} /> : null}
    </div>
  );
}

function HeatmapLegend({ counts }: { counts: DualSyncHeatmapCounts }) {
  const visible = HEATMAP_BUCKETS.filter((b) => counts[b] > 0 && b !== 'inactive');
  if (visible.length === 0) {
    if (counts.inactive === counts.total) {
      return <span className="font-mono text-[10px] text-muted-foreground">all inactive</span>;
    }
    return null;
  }
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
      {visible.map((bucket) => (
        <LegendChip key={bucket} bucket={bucket} value={counts[bucket]} />
      ))}
    </div>
  );
}

function LegendChip({ bucket, value }: { bucket: DualSyncHeatmapBucket; value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden="true"
        className={cn('inline-block h-2 w-2 rounded-sm', HEATMAP_BUCKET_TONE[bucket])}
      />
      <span>
        {value}
        <span className="ml-0.5 opacity-70">{shortLabel(bucket)}</span>
      </span>
    </span>
  );
}

function shortLabel(bucket: DualSyncHeatmapBucket): string {
  switch (bucket) {
    case 'in_sync':
      return 'sync';
    case 'drift':
      return 'drift';
    case 'conflict':
      return 'cnflct';
    case 'pending':
      return 'pndg';
    case 'failed':
      return 'fail';
    case 'inactive':
      return 'inact';
  }
}
