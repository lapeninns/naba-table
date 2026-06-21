import { Badge } from '@/components/ui/badge';

import type { DualSyncHealthMetricTileDescriptor } from './dualSyncOperationalHealthDomain';

type DualSyncHealthMetricTileProps = {
  metric: DualSyncHealthMetricTileDescriptor;
};

export function DualSyncHealthMetricTile({ metric }: DualSyncHealthMetricTileProps) {
  const badgeVariant =
    metric.tone === 'critical'
      ? 'status-cancelled'
      : metric.tone === 'warning'
        ? 'status-pending'
        : 'secondary';

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{metric.label}</div>
          <div className="text-xs text-muted-foreground">{metric.description}</div>
        </div>
        <Badge variant={badgeVariant} className="font-mono text-xs">
          {metric.value}
        </Badge>
      </div>
    </div>
  );
}
