'use client';

import { DateTime } from 'luxon';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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

function statusBadgeVariant(status: OpsEmailQueueJobStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
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
  onRefreshStateChange?: (state: { isRefreshing: boolean; lastUpdatedAt: number | null }) => void;
};

export function OpsEmailQueuePanel({
  restaurantId,
  timezone,
  enabled = true,
  refetchIntervalMs = false,
  refreshKey = 0,
  onRefreshStateChange,
}: OpsEmailQueuePanelProps) {
  const [status, setStatus] = useState<OpsEmailQueueJobStatus | 'all'>('all');
  const [page, setPage] = useState(1);

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
  });

  const jobs = query.jobs ?? [];
  const summary = query.summary;
  const total = query.response && query.response.ok ? query.response.pageInfo.total : 0;
  const showLoadingState = useMinimumDelay(query.isLoading || query.isFetching, {
    delayMs: 0,
    minDurationMs: 400,
  });
  const showRefetchIndicator = showLoadingState && jobs.length > 0;
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
      <Card className="border-slate-200/60 bg-white shadow-sm">
        <CardHeader className="space-y-4 border-b border-slate-200/70 pb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">Scheduled email queue</CardTitle>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                See which booking emails are scheduled to send later, ready to go out now, currently being sent, or need follow-up.
              </p>
            </div>

            {query.response && query.response.ok ? (
              <Badge
                variant="outline"
                className="w-fit border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-600"
              >
                {formatDateTime(query.response.timestamp, timezone)}
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {queueMetrics.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'rounded-xl border px-4 py-3 shadow-sm',
                  item.tone === 'slate' && 'border-slate-200/70 bg-slate-50/70',
                  item.tone === 'amber' && 'border-amber-200/70 bg-amber-50/80',
                  item.tone === 'blue' && 'border-sky-200/70 bg-sky-50/80',
                  item.tone === 'emerald' && 'border-emerald-200/70 bg-emerald-50/80',
                  item.tone === 'rose' && 'border-rose-200/70 bg-rose-50/80',
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{item.value}</div>
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
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
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

        <CardContent className="space-y-4 pt-5">
          {showRefetchIndicator ? (
            <div
              role="region"
              aria-label="Refreshing email queue"
              aria-busy="true"
              className="flex items-center gap-3 rounded-lg border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm text-sky-900"
            >
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <span className="font-medium">Refreshing queued jobs…</span>
            </div>
          ) : null}
          {query.apiError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {query.apiError.error}
            </div>
          ) : query.error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {query.error.message}
            </div>
          ) : showLoadingState && jobs.length === 0 ? (
            <div
              aria-label="Loading email queue"
              className="overflow-hidden rounded-xl border border-slate-200/70 bg-white"
            >
              <div className="grid grid-cols-[1.1fr_1.7fr_1.4fr_1.2fr_1.1fr] gap-3 border-b border-slate-200/70 px-4 py-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-4 w-20" />
                ))}
              </div>
              <div className="space-y-0">
                {Array.from({ length: 4 }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid grid-cols-[1.1fr_1.7fr_1.4fr_1.2fr_1.1fr] gap-3 border-b border-slate-200/60 px-4 py-4 last:border-b-0"
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
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
              <p className="text-base font-semibold text-slate-900">No queued emails right now</p>
              <p className="mt-2 text-sm text-slate-600">
                No booking emails are currently queued for this restaurant.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Scheduled reminders and confirmations will appear here as soon as jobs are waiting to send.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200/70 bg-slate-50/70 hover:bg-slate-50/70">
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Queue Status
                      </TableHead>
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Email
                      </TableHead>
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Reservation
                      </TableHead>
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Guest
                      </TableHead>
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Send Time
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="border-slate-200/60 hover:bg-slate-50/60">
                        <TableCell className="px-4 py-4 align-top">
                          <Badge
                            variant={statusBadgeVariant(job.status)}
                            className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide"
                          >
                            {statusLabel(job.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          <div className="text-sm font-semibold text-slate-900">{typeLabel(job.type)}</div>
                          <div className="mt-1 truncate font-mono text-[11px] text-slate-500" title={job.id}>
                            {job.id}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          {job.booking ? (
                            <div className="space-y-1.5">
                              <div className="font-mono text-xs font-semibold text-slate-700">
                                {job.booking.reference}
                              </div>
                              <div className="text-xs text-slate-500">
                                {formatDateTime(job.booking.startAt, timezone)}
                              </div>
                              {job.bookingId ? (
                                <Link
                                  href={`/app/bookings?restaurantId=${restaurantId ?? ''}&focus=${job.bookingId}`}
                                  prefetch={false}
                                  className="text-xs font-medium text-slate-700 underline underline-offset-2"
                                >
                                  Open booking
                                </Link>
                              ) : null}
                            </div>
                          ) : (
                            <div className="font-mono text-xs text-slate-500">{job.bookingId}</div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          <div className="text-sm font-medium text-slate-900">
                            {job.booking?.customerName ?? 'Unknown guest'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {job.booking?.customerEmail ?? '—'}
                          </div>
                          {job.failedReason ? (
                            <div className="mt-2 text-xs text-rose-700" title={job.failedReason}>
                              {job.failedReason}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          <div className="text-sm font-medium text-slate-900">
                            {formatDateTime(job.scheduledFor, timezone)}
                          </div>
                          {job.attemptsMade !== null ? (
                            <div className="mt-1 text-xs text-slate-500">Attempts: {job.attemptsMade}</div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-medium text-slate-600">
                  Page {page}
                  {total > 0 ? ` · ${total} job${total === 1 ? '' : 's'}` : ''}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={!query.response || query.response.ok === false || !query.response.pageInfo.hasNext}
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
