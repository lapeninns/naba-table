'use client';

import Link from 'next/link';

import { COMMS_CONTROL_HEIGHT_CLASS } from '@/components/features/communications-delivery/components/communicationsDeliveryClasses';
import { CommunicationsDeliveryTableRegion } from '@/components/features/communications-delivery/components/CommunicationsDeliveryTableRegion';
import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import {
  OPS_EMAIL_QUEUE_STATUS_OPTIONS,
  buildOpsEmailQueueMetrics,
  formatOpsEmailQueueDateTime,
  getOpsEmailQueueStatusLabel,
  getOpsEmailQueueStatusTone,
  getOpsEmailQueueTypeLabel,
} from '../opsEmailDeliveryDomain';

import type {
  OpsEmailQueueJobDTO,
  OpsEmailQueueJobStatus,
  OpsEmailQueueSummary,
} from '@/types/emailQueue';

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
  /** Jobs with a cancel or requeue in flight. */
  pendingJobIds?: ReadonlySet<string>;
  onCancelJob?: (jobId: string) => void;
  onRequeueJob?: (jobId: string) => void;
};

const EMPTY_JOB_IDS: ReadonlySet<string> = new Set();

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
  pendingJobIds = EMPTY_JOB_IDS,
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
              <Text variant="caption" className="mt-1 max-w-2xl">
                See which booking emails are scheduled to send later, ready to go out now, currently
                being sent, or need follow-up.
              </Text>
            </div>
            {timestamp ? (
              <Badge
                variant="outline"
                className="w-fit font-mono text-xs tabular-nums text-muted-foreground"
              >
                {formatOpsEmailQueueDateTime(timestamp, timezone)}
              </Badge>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
            {metrics.map((item) => (
              <div key={item.label} className="flex flex-col gap-1 bg-background px-3 py-2.5">
                <Text as="dt" variant="eyebrow">
                  {item.label}
                </Text>
                <dd className="text-lg font-semibold tabular-nums text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>

          <Select
            value={status}
            onValueChange={(value) => onStatusChange(value as OpsEmailQueueJobStatus | 'all')}
          >
            <SelectTrigger
              className={cn(COMMS_CONTROL_HEIGHT_CLASS, 'w-full sm:w-auto sm:min-w-[200px] max-w-full')}
              aria-label="Filter queue by status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS_EMAIL_QUEUE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.value === 'all' ? 'All queue statuses' : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>

        <CardContent
          className={cn(
            OPS_CARD_CONTENT_CLASS,
            'flex flex-col gap-4 pb-[var(--pg-density-card-py)] pt-4',
          )}
        >
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : isLoading && jobs.length === 0 ? (
            <div
              className="flex flex-col gap-2 rounded-lg border border-border p-3"
              aria-busy="true"
              aria-label="Loading email queue"
            >
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <OpsEmptyState
              title="No queued emails right now"
              description="No booking emails are currently queued for this restaurant. Scheduled reminders and confirmations will appear here as soon as jobs are waiting to send."
              size="compact"
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 lg:hidden">
                {jobs.map((job) => (
                  <article
                    key={job.id}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {getOpsEmailQueueTypeLabel(job.type)}
                        </div>
                        <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                          {job.id}
                        </div>
                      </div>
                      <OpsStatusBadge
                        className="shrink-0"
                        label={getOpsEmailQueueStatusLabel(job.status)}
                        tone={getOpsEmailQueueStatusTone(job.status)}
                      />
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
                        <dd className="text-right font-mono text-xs tabular-nums">
                          {formatOpsEmailQueueDateTime(job.scheduledFor, timezone)}
                        </dd>
                      </div>
                    </dl>
                    {job.bookingId ? (
                      <Link
                        href={`/app/bookings?restaurantId=${restaurantId ?? ''}&focus=${job.bookingId}`}
                        prefetch={false}
                        className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline sm:min-h-9"
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
                          className={cn(COMMS_CONTROL_HEIGHT_CLASS, 'flex-1 sm:flex-none')}
                          disabled={pendingJobIds.has(job.id)}
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
                          className={cn(COMMS_CONTROL_HEIGHT_CLASS, 'flex-1 sm:flex-none')}
                          disabled={pendingJobIds.has(job.id)}
                          onClick={() => onRequeueJob(job.id)}
                        >
                          Requeue
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <CommunicationsDeliveryTableRegion
                label="Scheduled email queue"
                hintBelow="none"
                className="hidden lg:flex"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Queue status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Reservation</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Send time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="align-top">
                          <OpsStatusBadge
                            label={getOpsEmailQueueStatusLabel(job.status)}
                            tone={getOpsEmailQueueStatusTone(job.status)}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="text-sm font-semibold">
                            {getOpsEmailQueueTypeLabel(job.type)}
                          </div>
                          <div
                            className="mt-1 max-w-[16rem] truncate font-mono text-xs text-muted-foreground"
                            title={job.id}
                          >
                            {job.id}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          {job.booking ? (
                            <div className="space-y-1.5">
                              <div className="font-mono text-xs font-semibold">
                                {job.booking.reference}
                              </div>
                              <div className="font-mono text-xs tabular-nums text-muted-foreground">
                                {formatOpsEmailQueueDateTime(job.booking.startAt, timezone)}
                              </div>
                              {job.bookingId ? (
                                <Link
                                  href={`/app/bookings?restaurantId=${restaurantId ?? ''}&focus=${job.bookingId}`}
                                  prefetch={false}
                                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
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
                        <TableCell className="align-top">
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
                        <TableCell className="align-top">
                          <div className="whitespace-nowrap font-mono text-xs tabular-nums">
                            {formatOpsEmailQueueDateTime(job.scheduledFor, timezone)}
                          </div>
                          {job.attemptsMade !== null ? (
                            <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                              Attempts: {job.attemptsMade}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-2">
                            {job.status !== 'dlq' && job.status !== 'active' && onCancelJob ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9"
                                disabled={pendingJobIds.has(job.id)}
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
                                className="h-9"
                                disabled={pendingJobIds.has(job.id)}
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
              </CommunicationsDeliveryTableRegion>

              <nav
                aria-label="Email queue pagination"
                className="flex items-center justify-between gap-3"
              >
                <div className="text-xs font-medium tabular-nums text-muted-foreground">
                  Page {page}
                  {total > 0 ? ` · ${total} job${total === 1 ? '' : 's'}` : ''}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={COMMS_CONTROL_HEIGHT_CLASS}
                    onClick={onPrevPage}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={COMMS_CONTROL_HEIGHT_CLASS}
                    onClick={onNextPage}
                    disabled={!hasNext}
                  >
                    Next
                  </Button>
                </div>
              </nav>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
