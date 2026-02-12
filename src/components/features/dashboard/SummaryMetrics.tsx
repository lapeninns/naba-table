import { ChevronDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

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

const PRIMARY_METRICS: Array<keyof OpsTodayTotals> = ['upcoming', 'pending', 'noShow'];
const SECONDARY_METRICS: Array<keyof OpsTodayTotals> = [
  'confirmed',
  'completed',
  'cancelled',
  'total',
  'covers',
];

type SummaryMetricsProps = {
  totals: OpsTodayTotals;
  primaryOnly?: boolean;
  collapsibleSecondary?: boolean;
};

export function SummaryMetrics({
  totals,
  primaryOnly = false,
  collapsibleSecondary = false,
}: SummaryMetricsProps) {
  const primaryMetrics = PRIMARY_METRICS.filter((key) => key in totals);
  const secondaryMetrics = SECONDARY_METRICS.filter(
    (key) => key in totals && !primaryMetrics.includes(key),
  );

  return (
    <div className="space-y-3">
      {/* Primary metrics: 2 cols on mobile, 4 cols on xl+ (accounting for sidebar width) */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      {!primaryOnly && secondaryMetrics.length > 0 ? (
        collapsibleSecondary ? (
          <Collapsible>
            <CollapsibleTrigger
              className="group inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Toggle more metrics"
            >
              More metrics
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <SecondaryMetricsGrid totals={totals} metrics={secondaryMetrics} />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <SecondaryMetricsGrid totals={totals} metrics={secondaryMetrics} />
        )
      ) : null}
    </div>
  );
}

function SecondaryMetricsGrid({
  totals,
  metrics,
}: {
  totals: OpsTodayTotals;
  metrics: Array<keyof OpsTodayTotals>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric}
          className={cn(
            'flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2',
          )}
        >
          <span className="text-xs font-medium text-muted-foreground">{METRIC_LABELS[metric]}</span>
          <span className="text-sm font-semibold text-foreground">{totals[metric]}</span>
        </div>
      ))}
    </div>
  );
}
