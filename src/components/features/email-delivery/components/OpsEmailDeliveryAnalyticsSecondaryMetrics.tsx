import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { OpsEmailAnalyticsSecondaryMetric } from '../opsEmailDeliveryAnalyticsDomain';

export type OpsEmailDeliveryAnalyticsSecondaryMetricsProps = {
  metrics: OpsEmailAnalyticsSecondaryMetric[];
};

export function OpsEmailDeliveryAnalyticsSecondaryMetrics({
  metrics,
}: OpsEmailDeliveryAnalyticsSecondaryMetricsProps) {
  return (
    <Card className="border-border bg-background shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">Secondary metrics</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <OpsEmailDeliveryAnalyticsMetricPair
            key={metric.key}
            label={metric.label}
            value={metric.value}
            testId={metric.testId}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function OpsEmailDeliveryAnalyticsMetricPair({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-foreground" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}
