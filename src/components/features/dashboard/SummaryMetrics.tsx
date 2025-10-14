import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { OpsTodayTotals } from '@/types/ops';

const metricOrder: Array<keyof OpsTodayTotals> = ['total', 'upcoming', 'completed', 'noShow', 'covers'];

const METRIC_LABELS: Record<keyof OpsTodayTotals, string> = {
  total: 'Bookings',
  upcoming: 'Upcoming',
  confirmed: 'Confirmed',
  completed: 'Shows',
  pending: 'Pending',
  cancelled: 'Cancelled',
  noShow: 'No shows',
  covers: 'Covers',
};

const PRIMARY_METRICS: Array<keyof OpsTodayTotals> = ['total', 'upcoming', 'completed', 'noShow'];

type SummaryMetricsProps = {
  totals: OpsTodayTotals;
};

export function SummaryMetrics({ totals }: SummaryMetricsProps) {
  const metricsToRender = PRIMARY_METRICS.filter((key) => key in totals);

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {metricsToRender.map((metric) => (
        <Card key={metric} className="border-border/60 bg-muted/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {METRIC_LABELS[metric]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {totals[metric]}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
