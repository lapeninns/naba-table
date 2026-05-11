'use client';

import { ChevronDown, Loader2 } from 'lucide-react';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { OpsCustomersSummary } from '@/types/ops';

type GuestsSummaryMetricsProps = {
  summary: OpsCustomersSummary | null;
  isLoading: boolean;
  isUpdating: boolean;
};

const PRIMARY_METRICS: Array<{
  key: keyof OpsCustomersSummary;
  label: string;
}> = [
  { key: 'total', label: 'Total guests' },
  { key: 'returning', label: 'Returning' },
  { key: 'vip', label: 'VIP' },
  { key: 'optedIn', label: 'Opted in' },
];

const SECONDARY_METRICS: Array<{
  key: keyof OpsCustomersSummary;
  label: string;
}> = [
  { key: 'optedOut', label: 'Opted out' },
  { key: 'neverVisited', label: 'Never visited' },
];

export function GuestsSummaryMetrics({
  summary,
  isLoading,
  isUpdating,
}: GuestsSummaryMetricsProps) {
  if (!summary && !isLoading) {
    return (
      <Alert className="border-border/60 bg-muted/20 text-foreground" role="status">
        <AlertTitle>Metrics unavailable</AlertTitle>
        <AlertDescription>
          Guest metrics couldn’t be calculated. The guest list is still available.
        </AlertDescription>
      </Alert>
    );
  }

  const metrics = summary ?? {
    total: 0,
    returning: 0,
    vip: 0,
    optedIn: 0,
    optedOut: 0,
    neverVisited: 0,
  };

  return (
    <section aria-label="Guest metrics" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Guest metrics</h2>
        {isUpdating ? (
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Updating…
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {PRIMARY_METRICS.map((metric) => (
          <Card key={metric.key} className={cn(OPS_CARD_CLASS, 'bg-muted/10')}>
            <CardHeader className={OPS_CARD_HEADER_CLASS}>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent className={OPS_CARD_CONTENT_CLASS}>
              {isLoading && !summary ? (
                <Skeleton className="h-7 w-12" data-testid={`guest-metric-${metric.key}`} />
              ) : (
                <p
                  data-testid={`guest-metric-${metric.key}`}
                  className={cn(
                    'text-2xl font-semibold tracking-tight text-foreground',
                    isLoading && 'opacity-60',
                  )}
                >
                  {metrics[metric.key]}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Collapsible>
        <CollapsibleTrigger
          className="group inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Toggle more metrics"
        >
          More metrics
          <ChevronDown
            className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {SECONDARY_METRICS.map((metric) => (
              <div
                key={metric.key}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
              >
                <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                {isLoading && !summary ? (
                  <Skeleton className="h-4 w-10" data-testid={`guest-metric-${metric.key}`} />
                ) : (
                  <span
                    data-testid={`guest-metric-${metric.key}`}
                    className="text-sm font-semibold text-foreground"
                  >
                    {metrics[metric.key]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
