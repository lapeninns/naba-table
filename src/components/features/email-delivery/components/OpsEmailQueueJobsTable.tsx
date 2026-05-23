'use client';

import Link from 'next/link';

import {
  formatOpsEmailQueueDateTime,
  getOpsEmailQueueStatusBadgeVariant,
  getOpsEmailQueueStatusLabel,
  getOpsEmailQueueTypeLabel,
} from '@/components/features/email-delivery/opsEmailQueuePanelDomain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { OpsEmailQueueJobDTO } from '@/types/emailQueue';

export type OpsEmailQueueJobsTableProps = {
  jobs: OpsEmailQueueJobDTO[];
  page: number;
  restaurantId: string | null;
  timezone: string;
  total: number;
  hasNext: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function OpsEmailQueueJobsTable({
  hasNext,
  jobs,
  onNextPage,
  onPreviousPage,
  page,
  restaurantId,
  timezone,
  total,
}: OpsEmailQueueJobsTableProps) {
  return (
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
                    variant={getOpsEmailQueueStatusBadgeVariant(job.status)}
                    className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide"
                  >
                    {getOpsEmailQueueStatusLabel(job.status)}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-4 align-top">
                  <div className="text-sm font-semibold text-foreground">
                    {getOpsEmailQueueTypeLabel(job.type)}
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
                        {formatOpsEmailQueueDateTime(job.booking.startAt, timezone)}
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
                    <div className="font-mono text-xs text-muted-foreground">{job.bookingId}</div>
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
                    {formatOpsEmailQueueDateTime(job.scheduledFor, timezone)}
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
            onClick={onPreviousPage}
            disabled={page <= 1}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border bg-background text-foreground hover:bg-muted"
            onClick={onNextPage}
            disabled={!hasNext}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}

export default OpsEmailQueueJobsTable;
