'use client';

import { AlertTriangle, BarChart3, TrendingDown } from 'lucide-react';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_FOOTER_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import {
  formatCount,
  formatDateTime,
  formatPenaltyValue,
  formatPercent,
  PENALTY_BADGE_VARIANTS,
  PENALTY_LABELS,
} from './rejectionDashboardDomain';
import { SummaryCard } from './RejectionDashboardMetrics';

import type { OpsRejectionAnalytics } from '@/types/ops';

export function RejectionAnalyticsPanel({
  activePresetLabel,
  analytics,
  error,
  isRefetching,
  loading,
  restaurantName,
}: {
  readonly activePresetLabel: string;
  readonly analytics: OpsRejectionAnalytics | null;
  readonly error: Error | null;
  readonly isRefetching: boolean;
  readonly loading: boolean;
  readonly restaurantName: string;
}) {
  const hasData = Boolean(analytics && analytics.summary.total > 0);

  return (
    <Card className={OPS_CARD_CLASS}>
      <CardHeader className={OPS_CARD_HEADER_CLASS}>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <BarChart3 className="size-5" aria-hidden />
          Rejection analytics
        </CardTitle>
        <CardDescription>
          Understand why bookings were unassigned. Data shown for {restaurantName} (
          {activePresetLabel}).
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-6')}>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="border-border/60">
            <AlertTitle>Unable to load analytics</AlertTitle>
            <AlertDescription>{error.message ?? 'An unexpected error occurred.'}</AlertDescription>
          </Alert>
        ) : hasData && analytics ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Total skipped"
              value={formatCount(analytics.summary.total)}
              description="Unassigned bookings"
            />
            <SummaryCard
              label="Hard rejections"
              value={`${formatCount(analytics.summary.hard.count)} · ${formatPercent(
                analytics.summary.hard.percent,
              )}`}
              description="Operational blockers"
            />
            <SummaryCard
              label="Strategic rejections"
              value={`${formatCount(analytics.summary.strategic.count)} · ${formatPercent(
                analytics.summary.strategic.percent,
              )}`}
              description="Scoring/prioritisation"
            />
          </div>
        ) : (
          <Alert className="border-border/60 bg-muted/20">
            <AlertTriangle className="size-4" aria-hidden />
            <AlertTitle>No rejection data available</AlertTitle>
            <AlertDescription>
              Selector did not reject any bookings for the selected range.
            </AlertDescription>
          </Alert>
        )}

        {hasData && analytics ? <RejectionAnalyticsBreakdown analytics={analytics} /> : null}
        {hasData && analytics ? <StrategicSamplesTable analytics={analytics} /> : null}
      </CardContent>

      {analytics?.range ? (
        <CardFooter
          className={cn(
            OPS_CARD_FOOTER_CLASS,
            'flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between',
          )}
        >
          <span>
            Window: {formatDateTime(analytics.range.from)} → {formatDateTime(analytics.range.to)}{' '}
            (bucket: {analytics.range.bucket})
          </span>
          {isRefetching ? <span>Refreshing data…</span> : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}

function RejectionAnalyticsBreakdown({ analytics }: { readonly analytics: OpsRejectionAnalytics }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className={cn(OPS_CARD_CLASS, 'lg:col-span-2')}>
        <CardHeader className={OPS_CARD_HEADER_CLASS}>
          <CardTitle className="text-base font-medium">Trend by {analytics.range.bucket}</CardTitle>
          <CardDescription>Volume of skipped bookings over the selected window.</CardDescription>
        </CardHeader>
        <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-2')}>
          {analytics.series.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data to plot for this period.</p>
          ) : (
            <ul className="space-y-2">
              {analytics.series.slice(-12).map((point) => {
                const total = point.hard + point.strategic;
                const hardPercent = total > 0 ? (point.hard / total) * 100 : 0;
                const strategicPercent = total > 0 ? (point.strategic / total) * 100 : 0;
                return (
                  <li key={point.bucket} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDateTime(point.bucket)}</span>
                      <span>{formatCount(total)} skipped</span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full border border-border/60">
                      <div
                        className="bg-muted/40"
                        style={{ width: `${Math.max(0, Math.min(100, hardPercent))}%` }}
                        aria-hidden
                      />
                      <div
                        className="bg-foreground/70"
                        style={{
                          width: `${Math.max(0, Math.min(100, strategicPercent))}%`,
                        }}
                        aria-hidden
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className={OPS_CARD_CLASS}>
        <CardHeader className={OPS_CARD_HEADER_CLASS}>
          <CardTitle className="text-base font-medium">Top hard rejection reasons</CardTitle>
          <CardDescription>Operational blockers that prevented immediate seating.</CardDescription>
        </CardHeader>
        <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-3')}>
          {analytics.summary.hard.topReasons.length > 0 ? (
            <ul className="space-y-2">
              {analytics.summary.hard.topReasons.map((reason) => (
                <li
                  key={reason.label}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-foreground">{reason.label}</span>
                  <span className="text-muted-foreground">{formatCount(reason.count)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No hard rejection reasons recorded.</p>
          )}
        </CardContent>
      </Card>

      <Card className={OPS_CARD_CLASS}>
        <CardHeader className={OPS_CARD_HEADER_CLASS}>
          <CardTitle className="text-base font-medium">Dominant strategic penalties</CardTitle>
          <CardDescription>
            Which penalty contributed most when scoring rejected plans.
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-3')}>
          {analytics.summary.strategic.topPenalties.length > 0 ? (
            <ul className="space-y-2">
              {analytics.summary.strategic.topPenalties.map((penalty) => (
                <li
                  key={penalty.penalty}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={cn('capitalize', PENALTY_BADGE_VARIANTS[penalty.penalty])}>
                      {PENALTY_LABELS[penalty.penalty]}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground">{formatCount(penalty.count)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No strategic penalties recorded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StrategicSamplesTable({ analytics }: { readonly analytics: OpsRejectionAnalytics }) {
  return (
    <Card className={OPS_CARD_CLASS}>
      <CardHeader className={OPS_CARD_HEADER_CLASS}>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <TrendingDown className="size-4" aria-hidden />
          Recent strategic rejection samples
        </CardTitle>
        <CardDescription>
          Inspect planner telemetry for the most recent strategic skips.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Booking ID</TableHead>
              <TableHead>Penalty</TableHead>
              <TableHead className="hidden lg:table-cell">Skip reason</TableHead>
              <TableHead className="text-right">Penalties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analytics.strategicSamples.map((sample) => (
              <TableRow key={`${sample.bookingId ?? 'unknown'}-${sample.createdAt}`}>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDateTime(sample.createdAt)}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {sample.bookingId ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn('capitalize', PENALTY_BADGE_VARIANTS[sample.dominantPenalty])}
                  >
                    {PENALTY_LABELS[sample.dominantPenalty]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  {sample.skipReason ?? 'Unspecified'}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  slack {formatPenaltyValue(sample.penalties.slack)} · scarcity{' '}
                  {formatPenaltyValue(sample.penalties.scarcity)} · future{' '}
                  {formatPenaltyValue(sample.penalties.futureConflict)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
