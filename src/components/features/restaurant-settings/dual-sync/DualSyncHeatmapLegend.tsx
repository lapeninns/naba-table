import { cn } from '@/lib/utils';

import type {
  DualSyncHeatmapLegendItemModel,
  DualSyncHeatmapRenderModel,
} from './dualSyncHeatmapRenderDomain';

export function DualSyncHeatmapLegend({ model }: { readonly model: DualSyncHeatmapRenderModel }) {
  if (model.inactiveOnlyLabel) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground">{model.inactiveOnlyLabel}</span>
    );
  }

  if (model.legendItems.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
      {model.legendItems.map((item) => (
        <DualSyncHeatmapLegendChip key={item.bucket} item={item} />
      ))}
    </div>
  );
}

function DualSyncHeatmapLegendChip({ item }: { readonly item: DualSyncHeatmapLegendItemModel }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden="true"
        className={cn('inline-block size-2 rounded-sm', item.toneClassName)}
      />
      <span>
        {item.value}
        <span className="ml-0.5 opacity-70">{item.shortLabel}</span>
      </span>
    </span>
  );
}
