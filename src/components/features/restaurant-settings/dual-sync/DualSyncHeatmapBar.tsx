import { cn } from '@/lib/utils';

import type {
  DualSyncHeatmapRenderModel,
  DualSyncHeatmapSegmentModel,
} from './dualSyncHeatmapRenderDomain';

export function DualSyncHeatmapBar({ model }: { readonly model: DualSyncHeatmapRenderModel }) {
  return (
    <div
      className="flex h-2 w-32 overflow-hidden rounded-sm border border-border/50"
      role="img"
      aria-label={model.ariaLabel}
    >
      {model.segments.map((segment) => (
        <DualSyncHeatmapSegment key={segment.bucket} segment={segment} />
      ))}
    </div>
  );
}

function DualSyncHeatmapSegment({ segment }: { readonly segment: DualSyncHeatmapSegmentModel }) {
  return (
    <div
      className={cn('h-full', segment.toneClassName)}
      style={{ width: `${segment.widthPercent}%` }}
      title={segment.title}
      data-bucket={segment.bucket}
    />
  );
}
