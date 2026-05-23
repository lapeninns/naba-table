import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { DualSyncFailureCodesPanel } from './DualSyncFailureCodesPanel';
import { DualSyncHealthMetricTile } from './DualSyncHealthMetricTile';
import { DualSyncOperationalAlertsList } from './DualSyncOperationalAlertsList';
import { buildOperationalHealthPanelModel } from './dualSyncOperationalHealthDomain';

import type { DualSyncOperationalMetrics } from '@/server/dual-sync/observability';

export function DualSyncOperationalHealthContent({
  className,
  metrics,
  onRefresh,
}: {
  readonly className?: string;
  readonly metrics: DualSyncOperationalMetrics;
  readonly onRefresh: () => void;
}) {
  const model = buildOperationalHealthPanelModel(metrics);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{model.windowLabel}</div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {model.metricTiles.map((metric) => (
          <DualSyncHealthMetricTile key={metric.key} metric={metric} />
        ))}
      </div>

      <DualSyncOperationalAlertsList alerts={model.alerts} />

      <Separator />

      <DualSyncFailureCodesPanel failureCounts={model.failureCounts} />
    </div>
  );
}
