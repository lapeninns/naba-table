'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, Copy, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  EMAIL_DELIVERY_STATUS_LABELS,
  formatEmailDeliveryOccurredAt,
  getEmailDeliveryStatusBadgeTone,
} from '@src/lib/email-delivery/presentation';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

// --- Sorting types ---

type SortColumn = 'sentAt' | 'status';
type SortDirection = 'asc' | 'desc';

type SortState = {
  column: SortColumn;
  direction: SortDirection;
};

// --- Subcomponents ---

function StatusBadge({ status }: { status: EmailDeliveryStatus }) {
  const tone = getEmailDeliveryStatusBadgeTone(status);
  return (
    <Badge
      variant={tone.variant}
      className={cn('text-[10px] font-bold uppercase tracking-wide whitespace-nowrap', tone.className)}
    >
      {EMAIL_DELIVERY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function CopyMessageIdButton({ text }: { text: string }) {
  const handleCopy = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const target = e.currentTarget;
      try {
        await navigator.clipboard.writeText(text);
        target.setAttribute('aria-label', 'Message ID copied');
      } catch {
        target.setAttribute('aria-label', 'Copy message id');
      }
    },
    [text],
  );

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      aria-label="Copy message id"
    >
      <Copy className="h-4 w-4" aria-hidden />
      <Check className="sr-only" aria-hidden />
      <span className="sr-only">Copy message id</span>
    </Button>
  );
}

function SortIndicator({ column, sortState }: { column: SortColumn; sortState: SortState }) {
  if (sortState.column !== column) {
    return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" aria-hidden />;
  }
  return sortState.direction === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden />
  );
}

function ExpandedRowDetail({
  attempt,
  timezone,
  restaurantId,
}: {
  attempt: OpsEmailDeliveryAttemptDTO;
  timezone: string;
  restaurantId: string;
}) {
  const errorEvent = attempt.events.find((e) => e.error);

  return (
    <div className="space-y-4 px-2 py-3">
      {/* Message ID */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Message ID
          </div>
          <div className="max-w-full break-all font-mono text-xs text-slate-600" title={attempt.messageId}>
            {attempt.messageId}
          </div>
        </div>
        <CopyMessageIdButton text={attempt.messageId} />
      </div>

      {attempt.bookingId ? (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/app/bookings?restaurantId=${restaurantId}&focus=${attempt.bookingId}`}
              prefetch={false}
              onClick={(event) => event.stopPropagation()}
            >
              Open booking
            </Link>
          </Button>
        </div>
      ) : null}

      {/* Error message */}
      {errorEvent?.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Error</div>
          <div className="text-xs text-rose-800">{errorEvent.error}</div>
        </div>
      ) : null}

      {/* Event Timeline */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Event Timeline
        </div>
        <div className="space-y-1.5">
          {attempt.events.map((event) => {
            const eventWhen = formatEmailDeliveryOccurredAt(event.occurredAt, timezone) ?? event.occurredAt;
            return (
              <div key={event.id} className="flex items-center gap-2 text-xs">
                <StatusBadge status={event.status} />
                <span className="text-slate-600">{eventWhen}</span>
                {event.error ? (
                  <span className="truncate text-rose-700" title={event.error}>
                    {event.error}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Loading skeleton ---

function TableLoadingSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading email delivery attempts">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

// --- Main component ---

export type OpsEmailDeliveryTableProps = {
  rows: OpsEmailDeliveryTableRowViewModel[];
  timezone: string;
  restaurantId: string;
  isLoading: boolean;
  retryingAttemptKey?: string | null;
  pendingRetryRow?: OpsEmailDeliveryTableRowViewModel | null;
  isRetryDialogOpen?: boolean;
  onRetryAttempt?: (attemptKey: string) => void;
  onRetryDialogOpenChange?: (open: boolean) => void;
  onConfirmRetry?: () => void;
};

export function OpsEmailDeliveryTable({
  rows,
  timezone,
  restaurantId: _restaurantId,
  isLoading,
  retryingAttemptKey = null,
  pendingRetryRow = null,
  isRetryDialogOpen = false,
  onRetryAttempt,
  onRetryDialogOpenChange,
  onConfirmRetry,
}: OpsEmailDeliveryTableProps) {
  const [sortState, setSortState] = useState<SortState>({
    column: 'sentAt',
    direction: 'desc',
  });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const handleSort = useCallback(
    (column: SortColumn) => {
      setSortState((prev) => {
        if (prev.column === column) {
          return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { column, direction: 'asc' };
      });
    },
    [],
  );

  const handleRowClick = useCallback(
    (key: string) => {
      setExpandedKey((prev) => (prev === key ? null : key));
    },
    [],
  );

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const dir = sortState.direction === 'asc' ? 1 : -1;
      if (sortState.column === 'sentAt') {
        if (a.sentAtMs !== b.sentAtMs) return (a.sentAtMs - b.sentAtMs) * dir;
        return a.attempt.messageId.localeCompare(b.attempt.messageId) * dir;
      }
      const statusCompare = a.statusSortValue.localeCompare(b.statusSortValue);
      if (statusCompare !== 0) return statusCompare * dir;
      const sentAtCompare = b.sentAtMs - a.sentAtMs;
      if (sentAtCompare !== 0) return sentAtCompare;
      return a.attempt.messageId.localeCompare(b.attempt.messageId);
    });
    return sorted;
  }, [rows, sortState]);

  if (isLoading && rows.length === 0) {
    return <TableLoadingSkeleton />;
  }

  return (
    <div className="rounded-lg border border-slate-200/60 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort('status')}
              aria-sort={sortState.column === 'status' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              Status
              <SortIndicator column="status" sortState={sortState} />
            </TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Email Type</TableHead>
            <TableHead>Booking Ref</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort('sentAt')}
              aria-sort={sortState.column === 'sentAt' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              Sent At
              <SortIndicator column="sentAt" sortState={sortState} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.flatMap((row) => {
            const key = row.attemptKey;
            const attempt = row.attempt;
            const isExpanded = expandedKey === key;

            const rows = [
              <TableRow
                key={key}
                className={cn(
                  'cursor-pointer',
                  isExpanded && 'bg-muted/30',
                )}
                onClick={() => handleRowClick(key)}
                data-state={isExpanded ? 'expanded' : undefined}
              >
                <TableCell>
                  <StatusBadge status={attempt.currentStatus} />
                </TableCell>
                <TableCell>
                  <span className="truncate text-sm font-medium" title={row.subject}>
                    {row.subject}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="truncate text-xs" title={row.recipientEmail}>
                    {row.recipientEmail}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {row.emailType ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">
                    {row.bookingReference ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">
                    {row.customerName ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-between gap-2">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.sentAtLabel ?? '—'}
                    </span>
                    <div className="flex items-center gap-1">
                      {row.canRetry ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          aria-label={`Retry email for ${attempt.recipientEmail}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRetryAttempt?.(key);
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                          Retry
                        </Button>
                      ) : null}
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 text-muted-foreground transition-transform',
                          isExpanded && 'rotate-180',
                        )}
                        aria-hidden
                      />
                    </div>
                  </div>
                </TableCell>
              </TableRow>,
            ];

            if (isExpanded) {
              rows.push(
                <TableRow key={`${key}__detail`} className="hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0">
                    <ExpandedRowDetail attempt={attempt} timezone={timezone} restaurantId={_restaurantId} />
                  </TableCell>
                </TableRow>,
              );
            }

            return rows;
          })}
        </TableBody>
      </Table>

      <AlertDialog open={isRetryDialogOpen} onOpenChange={onRetryDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry email delivery?</AlertDialogTitle>
            <AlertDialogDescription>
              This will resend the original email to the recipient. Use retry only for failed or bounced emails.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingRetryRow ? (
            <div className="space-y-3 rounded-lg border border-slate-200/70 bg-slate-50/70 p-4 text-sm">
              <div>
                <p className="font-medium text-slate-900">Recipient</p>
                <p className="text-slate-600">{pendingRetryRow.recipientEmail}</p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Subject</p>
                <p className="text-slate-600">{pendingRetryRow.subject}</p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Email type</p>
                <p className="text-slate-600">{pendingRetryRow.emailType ?? '—'}</p>
              </div>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                Warning: retrying will create a new delivery attempt and may send a duplicate email if the original eventually succeeds.
              </p>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(retryingAttemptKey)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void onConfirmRetry?.();
              }}
              disabled={!pendingRetryRow || Boolean(retryingAttemptKey)}
            >
              {retryingAttemptKey ? 'Retrying…' : 'Confirm Retry'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
