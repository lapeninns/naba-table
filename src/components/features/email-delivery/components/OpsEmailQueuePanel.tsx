'use client';

import { DateTime } from 'luxon';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOpsEmailQueueFeed } from '@/hooks/ops/useOpsEmailQueueFeed';
import { cn } from '@/lib/utils';
import { useMinimumDelay } from '@src/hooks/use-minimum-delay';

import type { OpsEmailQueueJobStatus } from '@/types/emailQueue';

const STATUS_OPTIONS: Array<{ value: OpsEmailQueueJobStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'delayed', label: 'Scheduled' },
  { value: 'waiting', label: 'Ready now' },
  { value: 'active', label: 'Sending now' },
  { value: 'dlq', label: 'Needs attention' },
];

function formatDateTime(value: string | null, timezone: string): string {
  if (!value) return '—';
  const dt = DateTime.fromISO(value, { zone: 'utc' }).setZone(timezone);
  if (!dt.isValid) return value;
  return dt.toFormat('EEE, MMM d · HH:mm');
}

function statusBadgeVariant(
  status: OpsEmailQueueJobStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'active':
      return 'default';
    case 'delayed':
      return 'secondary';
    case 'dlq':
      return 'destructive';
    case 'waiting':
    default:
      return 'outline';
  }
}

function statusLabel(status: OpsEmailQueueJobStatus): string {
  switch (status) {
    case 'dlq':
      return 'Needs attention';
    case 'active':
      return 'Sending now';
    case 'delayed':
      return 'Scheduled';
    case 'waiting':
    default:
      return 'Ready now';
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'reminder_24h':
      return '24-hour reminder';
    case 'reminder_short':
      return 'Short reminder';
    case 'review_request':
      return 'Review request';
    case 'request_received':
      return 'Request received';
    case 'confirmation':
      return 'Booking confirmation';
    case 'updated':
      return 'Booking update';
    case 'cancelled':
      return 'Cancellation notice';
    case 'booking_rejected':
      return 'Booking rejected';
    case 'restaurant_cancellation':
      return 'Restaurant cancellation';
    default:
      return type.replace(/_/g, ' ');
  }
}

export type OpsEmailQueuePanelProps = {
  restaurantId: string | null;
  timezone: string;
  enabled?: boolean;
  refetchIntervalMs?: number | false;
  refreshKey?: number;
  fixture?: string | null;
  onRefreshStateChange?: (state: { isRefreshing: boolean; lastUpdatedAt: number | null }) => void;
};

export function OpsEmailQueuePanel({
  restaurantId,
  timezone,
  enabled = true,
  refetchIntervalMs = false,
  refreshKey = 0,
  fixture = null,
  onRefreshStateChange,
}: OpsEmailQueuePanelProps) {
  const [status, setStatus] = useState<OpsEmailQueueJobStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const shouldForceFixtureLoadingMarker = fixture === 'loading' && enabled;

  useEffect(() => {
    setPage(1);
  }, [restaurantId]);

  const query = useOpsEmailQueueFeed({
    restaurantId,
    page,
    pageSize: 25,
    status: status === 'all' ? undefined : status,
    enabled,
    refetchIntervalMs: enabled ? refetchIntervalMs : false,
    fixture: fixture ?? undefined,
  });

  const jobs = query.jobs ?? [];
  const summary = query.summary;
  const total = query.response && query.response.ok ? query.response.pageInfo.total : 0;
  const showLoadingState = useMinimumDelay(query.isLoading || query.isFetching, {
    delayMs: 0,
    minDurationMs: 400,
  });
  const showRefetchIndicator =
    (showLoadingState || shouldForceFixtureLoadingMarker) && jobs.length > 0;
  const queueMetrics = [
    { label: 'Total in queue', value: summary?.total ?? 0, tone: 'slate' },
    { label: 'Scheduled for later', value: summary?.delayed ?? 0, tone: 'amber' },
    { label: 'Ready to send', value: summary?.waiting ?? 0, tone: 'blue' },
    { label: 'Sending now', value: summary?.active ?? 0, tone: 'emerald' },
    { label: 'Needs attention', value: summary?.dlq ?? 0, tone: 'rose' },
  ] as const;

  useEffect(() => {
    onRefreshStateChange?.({
      isRefreshing: query.isFetching,
      lastUpdatedAt: query.dataUpdatedAt > 0 ? query.dataUpdatedAt : null,
    });
  }, [onRefreshStateChange, query.dataUpdatedAt, query.isFetching]);

  useEffect(() => {
    if (!enabled || refreshKey === 0) return;
    void query.refetch();
  }, [enabled, query, refreshKey]);

  return (
    <section aria-label="Queue monitor" className="space-y-6">
      <Card className={OPS_CARD_CLASS}>
        <CardHeader className={cn(OPS_CARD_HEADER_CLASS, 'space-y-4 border-b')}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Scheduled email queue
              </CardTitle>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                See which booking emails are scheduled to send later, ready to go out now, currently
                being sent, or need follow-up.
              </p>
            </div>

            {query.response && query.response.ok ? (
              <Badge
                variant="outline"
                className="w-fit border-border bg-muted/40 font-mono text-[11px] text-muted-foreground"
              >
                {formatDateTime(query.response.timestamp, timezone)}
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {queueMetrics.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'rounded-xl border px-4 py-3 shadow-sm',
                  item.tone === 'slate' && 'border-border bg-muted/40',
                  item.tone === 'amber' && 'border-border bg-muted/40',
                  item.tone === 'blue' && 'border-primary/20 bg-primary/10',
                  item.tone === 'emerald' && 'border-primary/20 bg-primary/10',
                  item.tone === 'rose' && 'border-destructive/20 bg-destructive/10',
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={status === option.value ? 'default' : 'outline'}
                className={cn(
                  'rounded-full px-3.5 text-xs font-semibold',
                  status === option.value
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                )}
                onClick={() => {
                  setStatus(option.value);
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-4 pt-4')}>
          {showRefetchIndicator ? (
            <div
              role="region"
              aria-label="Refreshing email queue"
              aria-busy="true"
              className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground"
            >
              <Skeleton className="size-2.5 rounded-full" />
              <span className="font-medium">Refreshing queued jobs…</span>
            </div>
          ) : null}
          {query.apiError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {query.apiError.error}
            </div>
          ) : query.error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {query.error.message}
            </div>
          ) : (showLoadingState || shouldForceFixtureLoadingMarker) && jobs.length === 0 ? (
            <div
              aria-label="Loading email queue"
              className="overflow-hidden rounded-xl border border-border bg-background"
            >
              <div className="grid grid-cols-[1.1fr_1.7fr_1.4fr_1.2fr_1.1fr] gap-3 border-b border-border px-4 py-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-4 w-20" />
                ))}
              </div>
              <div className="space-y-0">
                {Array.from({ length: 4 }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid grid-cols-[1.1fr_1.7fr_1.4fr_1.2fr_1.1fr] gap-3 border-b border-border px-4 py-4 last:border-b-0"
                  >
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <OpsEmptyState
              title="No queued emails right now"
              description="No booking emails are currently queued for this restaurant. Scheduled reminders and confirmations will appear here as soon as jobs are waiting to send."
              className="min-h-[180px] bg-muted/40"
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Queue Status
                      </TableHead>
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Email
                      </TableHead>
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Reservation
                      </TableHead>
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Guest
                      </TableHead>
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Send Time
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="border-border hover:bg-muted/40">
                        <TableCell className="px-4 py-4 align-top">
                          <Badge
                            variant={statusBadgeVariant(job.status)}
                            className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide"
                          >
                            {statusLabel(job.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          <div className="text-sm font-semibold text-foreground">
                            {typeLabel(job.type)}
                          </div>
                          <div
                            className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
                            title={job.id}
                          >
                            {job.id}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          {job.booking ? (
                            <div className="space-y-1.5">
                              <div className="font-mono text-xs font-semibold text-foreground">
                                {job.booking.reference}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDateTime(job.booking.startAt, timezone)}
                              </div>
                              {job.bookingId ? (
                                <Link
                                  href={`/app/bookings?restaurantId=${restaurantId ?? ''}&focus=${job.bookingId}`}
                                  prefetch={false}
                                  className="text-xs font-medium text-foreground underline underline-offset-2"
                                >
                                  Open booking
                                </Link>
                              ) : null}
                            </div>
                          ) : (
                            <div className="font-mono text-xs text-muted-foreground">
                              {job.bookingId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          <div className="text-sm font-medium text-foreground">
                            {job.booking?.customerName ?? 'Unknown guest'}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {job.booking?.customerEmail ?? '—'}
                          </div>
                          {job.failedReason ? (
                            <div className="mt-2 text-xs text-destructive" title={job.failedReason}>
                              {job.failedReason}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          <div className="text-sm font-medium text-foreground">
                            {formatDateTime(job.scheduledFor, timezone)}
                          </div>
                          {job.attemptsMade !== null ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Attempts: {job.attemptsMade}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-medium text-muted-foreground">
                  Page {page}
                  {total > 0 ? ` · ${total} job${total === 1 ? '' : 's'}` : ''}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border bg-background text-foreground hover:bg-muted"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border bg-background text-foreground hover:bg-muted"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={
                      !query.response ||
                      query.response.ok === false ||
                      !query.response.pageInfo.hasNext
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
