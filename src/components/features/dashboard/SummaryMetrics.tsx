import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { OpsTodayTotals } from '@/types/ops';

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
const SECONDARY_METRICS: Array<keyof OpsTodayTotals> = ['confirmed', 'pending', 'cancelled', 'covers'];

type SummaryMetricsProps = {
  totals: OpsTodayTotals;
};

export function SummaryMetrics({ totals }: SummaryMetricsProps) {
  const primaryMetrics = PRIMARY_METRICS.filter((key) => key in totals);
  const secondaryMetrics = SECONDARY_METRICS.filter((key) => key in totals);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {primaryMetrics.map((metric) => (
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
      {secondaryMetrics.length > 0 ? (
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          {secondaryMetrics.map((metric) => (
            <div
              key={metric}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2"
            >
              <span className="text-xs font-medium text-muted-foreground">{METRIC_LABELS[metric]}</span>
              <span className="text-sm font-semibold text-foreground">{totals[metric]}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
