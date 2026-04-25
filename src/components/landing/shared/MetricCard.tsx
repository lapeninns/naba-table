import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { Icon } from './Icons';

type Metric = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  detail: string;
  icon: 'chart' | 'zap';
};

interface MetricCardProps {
  metric: Metric;
  reduceMotion?: boolean;
}

export function MetricCard({ metric }: MetricCardProps) {
  function formatMetricValue(val: number) {
    const formatted = val.toLocaleString('en-GB');
    return `${metric.prefix ?? ''}${formatted}${metric.suffix ?? ''}`;
  }

  return (
    <Card
      variant="compact"
      className="pg-panel overflow-hidden border-primary/15 bg-background/95 shadow-[var(--pg-shadow-xs)] transition-all duration-200"
    >
      <CardHeader className="flex flex-col gap-0 space-y-0 border-b border-border/60 bg-muted/35 p-4 sm:p-5 md:p-6">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary sm:mb-4">
          <Icon name={metric.icon} className="size-6" />
        </div>
        <div className="font-variant-numeric font-[var(--pg-font-mono)] text-3xl font-bold tabular-nums text-foreground transition-colors sm:text-4xl">
          {formatMetricValue(metric.value)}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
          {metric.label}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5 md:p-6">
        <Separator />
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {metric.detail}
        </p>
      </CardContent>
    </Card>
  );
}
