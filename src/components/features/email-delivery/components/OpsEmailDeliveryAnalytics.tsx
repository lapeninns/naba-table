'use client';

import { BarChart3 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { EMAIL_DELIVERY_STATUS_LABELS } from '@src/lib/email-delivery/presentation';

import type { OpsEmailDeliveryRange, OpsEmailDeliverySummary } from '@/types/emailDelivery';

const RANGE_OPTIONS: OpsEmailDeliveryRange[] = ['24h', '7d', '30d'];

type DistributionSegment = {
  key: string;
  label: string;
  count: number;
  toneClass: string;
};

function formatRate(value: number): string {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const pct = normalized * 100;
  return `${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const remSeconds = rounded % 60;
  if (minutes < 60) return `${minutes}m ${remSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function AnalyticsTile({
  label,
  value,
  hint,
  toneClass,
}: {
  label: string;
  value: string;
  hint?: string;
  toneClass: string;
}) {
  return (
    <Card className={cn('border shadow-sm', toneClass)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        {hint ? <p className="mt-2 text-sm text-slate-600">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function MetricPair({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-950" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

export type OpsEmailDeliveryAnalyticsProps = {
  summary: OpsEmailDeliverySummary | null;
  isLoading: boolean;
  isUpdating: boolean;
  range: OpsEmailDeliveryRange;
  onRangeChange: (range: OpsEmailDeliveryRange) => void;
  errorMessage?: string | null;
};

export function OpsEmailDeliveryAnalytics({
  summary,
  isLoading,
  isUpdating,
  range,
  onRangeChange,
  errorMessage,
}: OpsEmailDeliveryAnalyticsProps) {
  const total = summary?.total ?? 0;
  const failureCount = (summary?.bounced ?? 0) + (summary?.complained ?? 0) + (summary?.failed ?? 0);

  const distributionSegments: DistributionSegment[] = [
    {
      key: 'delivered',
      label: EMAIL_DELIVERY_STATUS_LABELS.delivered,
      count: summary?.delivered ?? 0,
      toneClass: 'bg-emerald-500',
    },
    {
      key: 'delivery_delayed',
      label: EMAIL_DELIVERY_STATUS_LABELS.delivery_delayed,
      count: summary?.deliveryDelayed ?? 0,
      toneClass: 'bg-amber-500',
    },
    {
      key: 'bounced',
      label: EMAIL_DELIVERY_STATUS_LABELS.bounced,
      count: summary?.bounced ?? 0,
      toneClass: 'bg-rose-400',
    },
    {
      key: 'failed',
      label: EMAIL_DELIVERY_STATUS_LABELS.failed,
      count: (summary?.complained ?? 0) + (summary?.failed ?? 0),
      toneClass: 'bg-rose-600',
    },
    {
      key: 'sent',
      label: EMAIL_DELIVERY_STATUS_LABELS.sent,
      count: summary?.sent ?? 0,
      toneClass: 'bg-slate-400',
    },
  ].filter((segment) => segment.count > 0 || total === 0);

  return (
    <section aria-label="Email delivery analytics" className="space-y-6">
      <Card className="border-slate-200/60 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" aria-hidden />
              <CardTitle className="text-base font-semibold text-slate-900">Delivery analytics</CardTitle>
              {isUpdating && !isLoading ? (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-600">
                  Updating…
                </Badge>
              ) : null}
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Measure delivery health over time with independent summary metrics, distribution, and failure hotspots.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Time range</div>
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(value) => {
                if (value === '24h' || value === '7d' || value === '30d') {
                  onRangeChange(value);
                }
              }}
              className="justify-start rounded-full border border-slate-200 bg-slate-50/80 p-1"
              aria-label="Analytics time range"
            >
              {RANGE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  className="rounded-full px-4 text-xs font-semibold data-[state=on]:bg-slate-900 data-[state=on]:text-white"
                  aria-label={`Analytics range ${option}`}
                >
                  {option}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load analytics</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading && !summary ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-28 rounded-xl" />
              <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            </>
          ) : summary ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AnalyticsTile
                  label="Total Attempts"
                  value={String(total)}
                  hint="Across the selected analytics window"
                  toneClass="border-slate-200/70 bg-slate-50/70"
                />
                <AnalyticsTile
                  label="Delivered"
                  value={String(summary.delivered)}
                  hint={`${formatRate(summary.deliveredRate)} delivery rate`}
                  toneClass="border-emerald-200/70 bg-emerald-50/80"
                />
                <AnalyticsTile
                  label="Delayed"
                  value={String(summary.deliveryDelayed)}
                  hint="Attempts waiting longer than expected"
                  toneClass="border-amber-200/70 bg-amber-50/80"
                />
                <AnalyticsTile
                  label="Failures"
                  value={String(failureCount)}
                  hint={`${formatRate(summary.failureRate)} failure rate`}
                  toneClass="border-rose-200/70 bg-rose-50/80"
                />
              </div>

              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4" data-testid="analytics-distribution-bar">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Status distribution</div>
                    <p className="text-sm text-slate-600">Share of attempts by current delivery state.</p>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-white text-xs text-slate-600">
                    {total} total attempts
                  </Badge>
                </div>

                <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-200">
                  <div className="flex h-full w-full">
                    {distributionSegments.map((segment) => {
                      const width = total > 0 ? (segment.count / total) * 100 : 0;
                      return (
                        <div
                          key={segment.key}
                          className={cn('h-full', segment.toneClass)}
                          style={{ width: `${width}%` }}
                          title={`${segment.label}: ${segment.count}`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {distributionSegments.map((segment) => (
                    <Badge key={segment.key} variant="outline" className="border-slate-200 bg-white text-xs text-slate-700">
                      <span className={cn('mr-2 inline-block h-2.5 w-2.5 rounded-full', segment.toneClass)} aria-hidden />
                      {segment.label}: {segment.count}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
                <Card className="border-slate-200/70 bg-white shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-900">Secondary metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <MetricPair label="p50 delivery time" value={formatDuration(summary.p50DeliverySeconds)} testId="analytics-p50" />
                    <MetricPair label="p95 delivery time" value={formatDuration(summary.p95DeliverySeconds)} testId="analytics-p95" />
                    <MetricPair label="Unique recipients" value={String(summary.uniqueRecipients)} testId="analytics-unique-recipients" />
                    <MetricPair label="Unique bookings" value={String(summary.uniqueBookings)} testId="analytics-unique-bookings" />
                  </CardContent>
                </Card>

                <Card className="border-slate-200/70 bg-white shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-900">Top failed templates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {summary.topFailedTemplates.length > 0 ? (
                      summary.topFailedTemplates.map((entry) => (
                        <div key={entry.templateType} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/60 bg-slate-50/70 px-3 py-2">
                          <span className="truncate text-sm text-slate-900" title={entry.templateType}>
                            {entry.templateType}
                          </span>
                          <Badge variant="secondary">{entry.count}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No failed templates in this range.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200/70 bg-white shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-900">Top failed email types</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {summary.topFailedEmailTypes.length > 0 ? (
                      summary.topFailedEmailTypes.map((entry) => (
                        <div key={entry.emailType} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/60 bg-slate-50/70 px-3 py-2">
                          <span className="truncate text-sm text-slate-900" title={entry.emailType}>
                            {entry.emailType}
                          </span>
                          <Badge variant="secondary">{entry.count}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No failed email types in this range.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : !errorMessage ? (
            <Alert className="border-slate-200/70 bg-slate-50/60">
              <AlertTitle>Analytics unavailable</AlertTitle>
              <AlertDescription>
                Summary metrics could not be calculated for this range right now.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
