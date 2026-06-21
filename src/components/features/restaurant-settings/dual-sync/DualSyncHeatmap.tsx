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

import { DualSyncHeatmapBar } from './DualSyncHeatmapBar';
import { DualSyncHeatmapLegend } from './DualSyncHeatmapLegend';
import { buildDualSyncHeatmapRenderModel } from './dualSyncHeatmapRenderDomain';

import type { DualSyncHeatmapCounts } from './heatmap';

export interface DualSyncHeatmapProps {
  readonly counts: DualSyncHeatmapCounts;
  /** Inline width hint. Defaults to 100% of container. */
  readonly className?: string;
  /** When true, render compact inline counts next to the bar. */
  readonly showLabels?: boolean;
}

export function DualSyncHeatmap({ counts, className, showLabels = true }: DualSyncHeatmapProps) {
  const model = buildDualSyncHeatmapRenderModel(counts);

  if (model.isEmpty) {
    return <HeatmapEmptyBadge label={model.emptyLabel} className={className} />;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DualSyncHeatmapBar model={model} />
      {showLabels ? <DualSyncHeatmapLegend model={model} /> : null}
    </div>
  );
}

function HeatmapEmptyBadge({
  label,
  className,
}: {
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground',
        className,
      )}
    >
      {label}
    </Badge>
  );
}
