/**
 * Restaurant-scoped dual-sync operational health panel.
 *
 * Uses the lazy metrics query from `useOpsDualSync` so operators can see
 * queue pressure, dead letters, quota failures, and partial publishes
 * without loading dashboard data on the main shell path.
 */

'use client';

import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type {
  DualSyncOperationalAlert,
  DualSyncOperationalAlertCode,
} from '@/server/dual-sync/observability';
import type { GetDualSyncMetricsResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

const ALERT_LABEL: Record<DualSyncOperationalAlertCode, string> = {
  QUEUE_BACKLOG: 'Queue backlog',
  DEAD_LETTER_JOBS: 'Dead letter jobs',
  QUOTA_LIMITED: 'Google quota',
  REAUTH_REQUIRED: 'Google reauth',
  STALE_DECISIONS: 'Stale decisions',
  PARTIAL_PUBLISH_FAILURES: 'Partial publishes',
};

const SUMMARY_ITEMS = [
  {
    key: 'queueBacklog',
    label: 'Queue backlog',
    description: 'Queued or retrying jobs',
  },
  {
    key: 'deadLetterJobs',
    label: 'Dead letters',
    description: 'Terminal queue jobs',
  },
  {
    key: 'partialPublishFailures',
    label: 'Partial publishes',
    description: 'Mixed publish results',
  },
] as const;

function formatTimestamp(value: string): string {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

function variantForAlert(alert: DualSyncOperationalAlert): 'status-cancelled' | 'status-pending' {
  return alert.severity === 'critical' ? 'status-cancelled' : 'status-pending';
}

function sortedCounts(counts: Readonly<Record<string, number>>): ReadonlyArray<[string, number]> {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function MetricTile({
  label,
  value,
  description,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly description: string;
  readonly tone: 'default' | 'warning' | 'critical';
}) {
  const badgeVariant =
    tone === 'critical' ? 'status-cancelled' : tone === 'warning' ? 'status-pending' : 'secondary';
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <Badge variant={badgeVariant} className="font-mono text-xs">
          {value}
        </Badge>
      </div>
    </div>
  );
}

function AlertList({ alerts }: { readonly alerts: ReadonlyArray<DualSyncOperationalAlert> }) {
  if (alerts.length === 0) {
    return (
      <Alert variant="success">
        <CheckCircle2 className="size-4" />
        <AlertTitle>No operational alerts</AlertTitle>
        <AlertDescription>
          Queue, quota, reauth, and publish-failure signals are clear.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <Alert key={alert.code} variant={alert.severity === 'critical' ? 'destructive' : 'warning'}>
          <AlertTriangle className="size-4" />
          <AlertTitle>{ALERT_LABEL[alert.code]}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{alert.message}</span>
            <Badge variant={variantForAlert(alert)} className="w-fit font-mono text-[10px]">
              Count: {alert.count}
            </Badge>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

export interface DualSyncOperationalHealthPanelProps {
  readonly metricsQuery: UseQueryResult<GetDualSyncMetricsResponse, Error>;
  readonly className?: string;
}

export function DualSyncOperationalHealthPanel({
  metricsQuery,
  className,
}: DualSyncOperationalHealthPanelProps) {
  const metrics = metricsQuery.data ?? null;
  const failureCounts = useMemo(
    () => sortedCounts(metrics?.failureCounts ?? {}),
    [metrics?.failureCounts],
  );
  const quotaLimited = metrics?.failureCounts.QUOTA_LIMITED ?? 0;
  const reauthRequired = metrics?.failureCounts.REAUTH_REQUIRED ?? 0;

  if (metricsQuery.isLoading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-2 md:grid-cols-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (metricsQuery.isError) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="size-4" />
        <AlertTitle>Couldn&apos;t load operational health.</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{metricsQuery.error?.message ?? 'Unknown error.'}</span>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => metricsQuery.refetch()}
          >
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!metrics) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        No operational metrics loaded for this restaurant yet.
      </div>
    );
  }

  const deadLetterTone = metrics.deadLetterJobs > 0 ? 'critical' : 'default';
  const quotaTone = reauthRequired > 0 ? 'critical' : quotaLimited > 0 ? 'warning' : 'default';

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Window: {formatTimestamp(metrics.windowStart)} to {formatTimestamp(metrics.windowEnd)}
        </div>
        <Button variant="outline" size="sm" onClick={() => metricsQuery.refetch()}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {SUMMARY_ITEMS.map((item) => (
          <MetricTile
            key={item.key}
            label={item.label}
            value={metrics[item.key]}
            description={item.description}
            tone={
              item.key === 'deadLetterJobs'
                ? deadLetterTone
                : metrics[item.key] > 0
                  ? 'warning'
                  : 'default'
            }
          />
        ))}
        <MetricTile
          label="Google failures"
          value={quotaLimited + reauthRequired}
          description="Quota or reauth errors"
          tone={quotaTone}
        />
      </div>

      <AlertList alerts={metrics.alerts} />

      <Separator />

      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Failure codes
        </div>
        {failureCounts.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {failureCounts.map(([code, count]) => (
              <Badge key={code} variant="outline" className="font-mono text-[10px]">
                {code}: {count}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No failure codes in this window.</div>
        )}
      </div>
    </div>
  );
}
