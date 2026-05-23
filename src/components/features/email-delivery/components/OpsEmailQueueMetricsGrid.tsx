'use client';

import { cn } from '@/lib/utils';

import type { OpsEmailQueueMetric } from '@/components/features/email-delivery/opsEmailQueuePanelDomain';

export type OpsEmailQueueMetricsGridProps = {
  metrics: OpsEmailQueueMetric[];
};

export function OpsEmailQueueMetricsGrid({ metrics }: OpsEmailQueueMetricsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-xl border px-4 py-3 shadow-sm',
            item.tone === 'slate' && 'border-border bg-muted/40',
            item.tone === 'amber' && 'border-border bg-muted/40',
            item.tone === 'blue' && 'border-primary/20 bg-primary/10',
            item.tone === 'emerald' && 'border-primary/20 bg-primary/10',
            item.tone === 'rose' && 'border-destructive/20 bg-destructive/10',
          )}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {item.label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default OpsEmailQueueMetricsGrid;
