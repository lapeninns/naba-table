'use client';

import { ChevronDown } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  EMAIL_DELIVERY_STALE_THRESHOLD_HOURS,
  type EmailDeliveryStatus,
  type OpsEmailDeliverySummary,
} from '@/types/emailDelivery';
import { EMAIL_DELIVERY_STATUS_LABELS } from '@src/lib/email-delivery/presentation';

export type OpsEmailDeliverySummaryMetricsProps = {
  summary: OpsEmailDeliverySummary | null;
  isLoading: boolean;
  isUpdating: boolean;
  onFilterStatus?: (status: EmailDeliveryStatus | null) => void;
};

type Segment = {
  status: EmailDeliveryStatus;
  count: number;
  className: string;
};

function clampRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatRate(value: number): string {
  const pct = clampRate(value) * 100;
  const rounded = pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  return `${rounded}%`;
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const totalSeconds = Math.round(seconds);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const remSeconds = totalSeconds % 60;
  if (totalMinutes < 60) return `${totalMinutes}m ${remSeconds}s`;
  const hours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  return `${hours}h ${remMinutes}m`;
}

function MetricTile({
  label,
  value,
  hint,
  tone,
  onClick,
  testId,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  onClick?: (() => void) | undefined;
  testId?: string;
}) {
  const toneClass =
    tone === 'good'
      ? 'border-primary/30 bg-primary/10'
      : tone === 'warn'
        ? 'border-primary/30 bg-primary/10'
        : tone === 'bad'
          ? 'border-destructive/20 bg-destructive/10'
          : 'border-border/60 bg-muted/10';

  const inner = (
    <Card className={cn(toneClass, onClick ? 'transition-colors hover:bg-muted/15' : null)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight text-foreground" data-testid={testId}>
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );

  if (!onClick) return inner;

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full justify-start p-0 text-left hover:bg-transparent"
      onClick={onClick}
    >
      {inner}
    </Button>
  );
}

function SecondaryMetric({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

export function OpsEmailDeliverySummaryMetrics({
  summary,
  isLoading,
  isUpdating,
  onFilterStatus,
}: OpsEmailDeliverySummaryMetricsProps) {
  if (isLoading && !summary) {
    return (
      <section aria-label="Email delivery metrics">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">Deliverability</div>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Loading…
          </Badge>
        </div>
        <div className="mt-3 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[92px] w-full" />
          <Skeleton className="h-[92px] w-full" />
          <Skeleton className="h-[92px] w-full" />
          <Skeleton className="h-[92px] w-full" />
        </div>
      </section>
    );
  }

  if (!summary) {
    return (
      <Alert className="border-border bg-muted/40">
        <AlertTitle>Metrics unavailable</AlertTitle>
        <AlertDescription>
          Deliverability metrics couldn’t be calculated. The attempt list is still available.
        </AlertDescription>
      </Alert>
    );
  }

  const total = Math.max(0, Math.floor(summary.total));
  const failures = Math.max(0, Math.floor(summary.bounced + summary.complained + summary.failed));
  const stuckInFlight = Math.max(0, Math.floor(summary.stuckInFlight ?? 0));

  const segments: Segment[] = [
    { status: 'delivered', count: summary.delivered, className: 'bg-primary/10' },
    { status: 'delivery_delayed', count: summary.deliveryDelayed, className: 'bg-primary/10' },
    { status: 'bounced', count: summary.bounced, className: 'bg-destructive/10' },
    { status: 'complained', count: summary.complained, className: 'bg-destructive/10' },
    { status: 'failed', count: summary.failed, className: 'bg-destructive/10' },
    { status: 'sent', count: summary.sent, className: 'bg-muted/40' },
  ];

  const statusLines = segments
    .filter((s) => s.count > 0)
    .map((s) => `${EMAIL_DELIVERY_STATUS_LABELS[s.status]}: ${s.count}`);

  return (
    <section aria-label="Email delivery metrics" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">Deliverability</div>
        {isUpdating ? (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Updating…
          </Badge>
        ) : null}
      </div>

      {stuckInFlight > 0 ? (
        <Alert variant="destructive" className="border-primary/30 bg-primary/10 text-primary">
          <AlertTitle className="text-sm font-semibold">
            {stuckInFlight} email{stuckInFlight === 1 ? '' : 's'} stuck without a delivery receipt
          </AlertTitle>
          <AlertDescription className="text-xs">
            These were accepted by the provider more than {EMAIL_DELIVERY_STALE_THRESHOLD_HOURS}h
            ago but never received a terminal webhook (<code>delivered</code> / <code>bounced</code>{' '}
            / <code>failed</code>). Likely causes: dropped webhook, provider incident, or the
            recipient mailbox silently discarded it. Open any row below flagged &ldquo;Stuck&rdquo;
            to investigate or retry.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Total attempts"
          value={String(total)}
          tone="neutral"
          onClick={onFilterStatus ? () => onFilterStatus(null) : undefined}
          testId="email-metric-total"
        />
        <MetricTile
          label="Delivered"
          value={String(summary.delivered)}
          hint={`${formatRate(summary.deliveredRate)} delivered`}
          tone="good"
          onClick={onFilterStatus ? () => onFilterStatus('delivered') : undefined}
          testId="email-metric-delivered"
        />
        <MetricTile
          label="Delayed"
          value={String(summary.deliveryDelayed)}
          tone="warn"
          onClick={onFilterStatus ? () => onFilterStatus('delivery_delayed') : undefined}
          testId="email-metric-delayed"
        />
        <MetricTile
          label="Failures"
          value={String(failures)}
          hint={`${formatRate(summary.failureRate)} failure rate`}
          tone="bad"
          testId="email-metric-failures"
        />
      </div>

      <div
        className="rounded-lg border border-border/60 bg-muted/10 p-3"
        aria-label="Status distribution"
        data-testid="email-delivery-distribution"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-muted-foreground">Status distribution</div>
          <div className="text-xs text-muted-foreground">
            {total > 0 ? statusLines.join(' · ') : 'No attempts'}
          </div>
        </div>

        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="flex h-full w-full">
            {segments.map((segment) => {
              const pct = total > 0 ? (segment.count / total) * 100 : 0;
              if (pct <= 0) return null;
              const label = EMAIL_DELIVERY_STATUS_LABELS[segment.status] ?? segment.status;
              return (
                <div
                  key={segment.status}
                  className={cn('h-full', segment.className)}
                  style={{ width: `${pct}%` }}
                  title={`${label}: ${segment.count} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>
        </div>

        <div className="sr-only">
          {segments.map((segment) => {
            const label = EMAIL_DELIVERY_STATUS_LABELS[segment.status] ?? segment.status;
            return (
              <div key={segment.status}>
                {label}: {segment.count} of {total}
              </div>
            );
          })}
        </div>
      </div>

      <Collapsible>
        <CollapsibleTrigger
          className="group inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Toggle more metrics"
        >
          More metrics
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <SecondaryMetric
              label="Sent-only"
              value={String(summary.sent)}
              testId="email-metric-sent"
            />
            <SecondaryMetric
              label="Bounced"
              value={String(summary.bounced)}
              testId="email-metric-bounced"
            />
            <SecondaryMetric
              label="Complained"
              value={String(summary.complained)}
              testId="email-metric-complained"
            />
            <SecondaryMetric
              label="Failed"
              value={String(summary.failed)}
              testId="email-metric-failed"
            />
            <SecondaryMetric
              label="Unique recipients"
              value={String(summary.uniqueRecipients)}
              testId="email-metric-uniqueRecipients"
            />
            <SecondaryMetric
              label="Unique bookings"
              value={String(summary.uniqueBookings)}
              testId="email-metric-uniqueBookings"
            />
            <SecondaryMetric
              label="p50 delivery time"
              value={formatDurationSeconds(summary.p50DeliverySeconds)}
              testId="email-metric-p50DeliverySeconds"
            />
            <SecondaryMetric
              label="p95 delivery time"
              value={formatDurationSeconds(summary.p95DeliverySeconds)}
              testId="email-metric-p95DeliverySeconds"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-border/60 bg-muted/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Top failed templates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.topFailedTemplates.length > 0 ? (
                  summary.topFailedTemplates.map((entry) => (
                    <div
                      key={entry.templateType}
                      className="flex items-center justify-between gap-3"
                    >
                      <span
                        className="min-w-0 truncate text-sm text-foreground"
                        title={entry.templateType}
                      >
                        {entry.templateType}
                      </span>
                      <Badge variant="secondary">{entry.count}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No failures in this range.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-muted/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Top failed email types
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.topFailedEmailTypes.length > 0 ? (
                  summary.topFailedEmailTypes.map((entry) => (
                    <div key={entry.emailType} className="flex items-center justify-between gap-3">
                      <span
                        className="min-w-0 truncate text-sm text-foreground"
                        title={entry.emailType}
                      >
                        {entry.emailType}
                      </span>
                      <Badge variant="secondary">{entry.count}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No failures in this range.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
