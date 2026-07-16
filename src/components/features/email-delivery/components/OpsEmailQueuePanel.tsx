'use client';

import Link from 'next/link';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  OPS_EMAIL_QUEUE_STATUS_OPTIONS,
  buildOpsEmailQueueMetrics,
  formatOpsEmailQueueDateTime,
  getOpsEmailQueueStatusLabel,
  getOpsEmailQueueTypeLabel,
} from '../opsEmailDeliveryDomain';

import type { OpsEmailQueueJobDTO, OpsEmailQueueJobStatus, OpsEmailQueueSummary } from '@/types/emailQueue';

export type OpsEmailQueuePanelProps = {
  jobs: OpsEmailQueueJobDTO[];
  summary: OpsEmailQueueSummary | null | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  timezone: string;
  restaurantId: string | null;
  status: OpsEmailQueueJobStatus | 'all';
  onStatusChange: (status: OpsEmailQueueJobStatus | 'all') => void;
  page: number;
  hasNext: boolean;
  total: number;
  timestamp: string | null;
  onPrevPage: () => void;
  onNextPage: () => void;
  actionJobId?: string | null;
  onCancelJob?: (jobId: string) => void;
  onRequeueJob?: (jobId: string) => void;
};

export function OpsEmailQueuePanel({
  jobs,
  summary,
  isLoading,
  errorMessage,
  timezone,
  restaurantId,
  status,
  onStatusChange,
  page,
  hasNext,
  total,
  timestamp,
  onPrevPage,
  onNextPage,
  actionJobId = null,
  onCancelJob,
  onRequeueJob,
}: OpsEmailQueuePanelProps) {
  const metrics = buildOpsEmailQueueMetrics(summary);

  return (
    <section aria-label="Queue monitor">
      <Card className={OPS_CARD_CLASS}>
        <CardHeader className={cn(OPS_CARD_HEADER_CLASS, 'flex flex-col gap-4 border-b')}>
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
            {timestamp ? (
              <Badge
                variant="outline"
                className="w-fit border-border bg-muted/40 font-mono text-[11px] text-muted-foreground"
              >
                {formatOpsEmailQueueDateTime(timestamp, timezone)}
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {metrics.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border bg-muted/40 px-4 py-3 shadow-sm"
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
            {OPS_EMAIL_QUEUE_STATUS_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={status === option.value ? 'default' : 'outline'}
                className="rounded-full px-3.5 text-xs font-semibold"
                onClick={() => onStatusChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'flex flex-col gap-4 pt-4')}>
          {errorMessage ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : isLoading && jobs.length === 0 ? (
            <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground" aria-label="Loading email queue">
              Loading email queue…
            </div>
          ) : jobs.length === 0 ? (
            <OpsEmptyState
              title="No queued emails right now"
              description="No booking emails are currently queued for this restaurant. Scheduled reminders and confirmations will appear here as soon as jobs are waiting to send."
              className="min-h-[180px] bg-muted/40"
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 lg:hidden">
                {jobs.map((job) => (
                  <article
                    key={job.id}
                    className="rounded-xl border border-border bg-background p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{getOpsEmailQueueTypeLabel(job.type)}</div>
                        <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                          {job.id}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] font-bold uppercase">
                        {getOpsEmailQueueStatusLabel(job.status)}
                      </Badge>
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Reservation</dt>
                        <dd className="text-right font-mono text-xs">
                          {job.booking?.reference ?? job.bookingId}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Guest</dt>
                        <dd className="text-right text-sm">
                          {job.booking?.customerName ?? 'Unknown guest'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Send time</dt>
                        <dd className="text-right text-sm">
                          {formatOpsEmailQueueDateTime(job.scheduledFor, timezone)}
                        </dd>
                      </div>
                    </dl>
                    {job.bookingId ? (
                      <Link
                        href={`/app/bookings?restaurantId=${restaurantId ?? ''}&focus=${job.bookingId}`}
                        prefetch={false}
                        className="mt-3 inline-block text-xs font-medium underline underline-offset-2"
                      >
                        Open booking
                      </Link>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {job.status !== 'dlq' && job.status !== 'active' && onCancelJob ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionJobId === job.id}
                          onClick={() => onCancelJob(job.id)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                      {job.status === 'dlq' && onRequeueJob ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionJobId === job.id}
                          onClick={() => onRequeueJob(job.id)}
                        >
                          Requeue
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-xl border border-border bg-background lg:block">
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
                      <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="border-border hover:bg-muted/40">
                        <TableCell className="px-4 py-4 align-top">
                          <Badge variant="outline" className="text-[10px] font-bold uppercase">
                            {getOpsEmailQueueStatusLabel(job.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          <div className="text-sm font-semibold">
                            {getOpsEmailQueueTypeLabel(job.type)}
                          </div>
                          <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                            {job.id}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          {job.booking ? (
                            <div className="space-y-1.5">
                              <div className="font-mono text-xs font-semibold">
                                {job.booking.reference}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatOpsEmailQueueDateTime(job.booking.startAt, timezone)}
                              </div>
                              {job.bookingId ? (
                                <Link
                                  href={`/app/bookings?restaurantId=${restaurantId ?? ''}&focus=${job.bookingId}`}
                                  prefetch={false}
                                  className="text-xs font-medium underline underline-offset-2"
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
                          <div className="text-sm font-medium">
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
                          <div className="text-sm font-medium">
                            {formatOpsEmailQueueDateTime(job.scheduledFor, timezone)}
                          </div>
                          {job.attemptsMade !== null ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Attempts: {job.attemptsMade}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            {job.status !== 'dlq' && job.status !== 'active' && onCancelJob ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={actionJobId === job.id}
                                onClick={() => onCancelJob(job.id)}
                              >
                                Cancel
                              </Button>
                            ) : null}
                            {job.status === 'dlq' && onRequeueJob ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={actionJobId === job.id}
                                onClick={() => onRequeueJob(job.id)}
                              >
                                Requeue
                              </Button>
                            ) : null}
                          </div>
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
                    onClick={onPrevPage}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onNextPage}
                    disabled={!hasNext}
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
