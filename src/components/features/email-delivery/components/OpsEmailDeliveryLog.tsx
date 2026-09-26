'use client';

import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, MailWarning, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { CopyButton } from '@/components/ui/copy-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Text } from '@/components/ui/typography';
import { useIsMobileState } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  EMAIL_DELIVERY_STATUS_LABELS,
  formatEmailDeliveryOccurredAt,
  getEmailDeliveryStatusBadgeTone,
} from '@/src/lib/email-delivery/presentation';

import { OPS_EMAIL_DELIVERY_PAGE_SIZE_OPTIONS } from '../opsEmailDeliveryTypes';

import type { OpsEmailDeliveryTableRowViewModel } from '../opsEmailDeliveryTypes';
import type { EmailDeliveryStatus } from '@/types/emailDelivery';

function StatusBadge({ status }: { status: EmailDeliveryStatus }) {
  const tone = getEmailDeliveryStatusBadgeTone(status);
  return (
    <Badge
      variant={tone.variant}
      className={cn('text-[10px] font-bold uppercase tracking-wide', tone.className)}
    >
      {EMAIL_DELIVERY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export type OpsEmailDeliveryLogProps = {
  unavailable: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  rows: OpsEmailDeliveryTableRowViewModel[];
  timezone: string;
  restaurantId: string;
  /** Rows whose resend is in flight. */
  retryingAttemptKeys: ReadonlySet<string>;
  /** The confirmed resend in the dialog is being sent. */
  isConfirmingRetry: boolean;
  pendingRetryRow: OpsEmailDeliveryTableRowViewModel | null;
  isRetryDialogOpen: boolean;
  onRetryAttempt: (attemptKey: string) => void;
  onRetryDialogOpenChange: (open: boolean) => void;
  onConfirmRetry: () => void;
  onRefetch: () => void;
  shouldShowPagination: boolean;
  currentPage: number;
  currentPageSize: number;
  totalResults: number;
  startResult: number;
  endResult: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function OpsEmailDeliveryLog({
  unavailable,
  errorMessage,
  isLoading,
  rows,
  timezone,
  restaurantId,
  retryingAttemptKeys,
  isConfirmingRetry,
  pendingRetryRow,
  isRetryDialogOpen,
  onRetryAttempt,
  onRetryDialogOpenChange,
  onConfirmRetry,
  onRefetch,
  shouldShowPagination,
  currentPage,
  currentPageSize,
  totalResults,
  startResult,
  endResult,
  hasPrevPage,
  hasNextPage,
  onPrev,
  onNext,
  onPageSizeChange,
}: OpsEmailDeliveryLogProps) {
  const isBelowLg = useIsMobileState(1024);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      {unavailable ? (
        <Alert className="border-border bg-muted/40">
          <MailWarning className="size-4" aria-hidden />
          <AlertTitle>Delivery tracking unavailable</AlertTitle>
          <AlertDescription>
            This environment is not currently recording or exposing delivery events. Email sending
            can still work normally.
          </AlertDescription>
        </Alert>
      ) : errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Unable to load email delivery attempts</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{errorMessage}</p>
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-destructive underline-offset-4 hover:underline"
              onClick={onRefetch}
            >
              <RotateCcw data-icon="inline-start" aria-hidden />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading && rows.length === 0 ? (
        <div
          className="rounded-lg border border-border p-8 text-sm text-muted-foreground"
          aria-label="Loading email delivery attempts"
        >
          Loading delivery attempts…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-background p-8 text-center">
          <p className="text-base font-semibold text-foreground">No email deliveries found</p>
          <Text variant="caption" className="mt-2">
            Adjust the filters or try a wider date range to see more results.
          </Text>
        </div>
      ) : isBelowLg === undefined ? (
        <div
          className="rounded-lg border border-border p-8 text-sm text-muted-foreground"
          aria-label="Loading email delivery attempts"
        >
          Loading delivery attempts…
        </div>
      ) : isBelowLg ? (
        <div className="grid grid-cols-1 gap-3">
          {rows.map((row) => {
            const isExpanded = expandedKey === row.attemptKey;
            return (
              <article
                key={row.attemptKey}
                className="rounded-lg border border-border bg-background p-4"
              >
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-between gap-3 px-0 py-0 text-left hover:bg-transparent"
                  onClick={() =>
                    setExpandedKey((current) =>
                      current === row.attemptKey ? null : row.attemptKey,
                    )
                  }
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={row.attempt.currentStatus} />
                      <span className="truncate text-sm font-semibold">{row.subject}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.recipientEmail}
                      {row.sentAtLabel ? ` · ${row.sentAtLabel}` : ''}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </Button>
                {row.canRetry ? (
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={retryingAttemptKeys.has(row.attemptKey)}
                      aria-label={`Retry email for ${row.recipientEmail}`}
                      onClick={() => onRetryAttempt(row.attemptKey)}
                    >
                      <RotateCcw data-icon="inline-start" aria-hidden />
                      {retryingAttemptKeys.has(row.attemptKey) ? 'Sending…' : 'Retry'}
                    </Button>
                  </div>
                ) : null}
                {isExpanded ? (
                  <AttemptDetail row={row} timezone={timezone} restaurantId={restaurantId} />
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Email Type</TableHead>
                <TableHead>Booking Ref</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.flatMap((row) => {
                const isExpanded = expandedKey === row.attemptKey;
                const nodes = [
                  <TableRow
                    key={row.attemptKey}
                    className={cn('cursor-pointer', isExpanded && 'bg-muted/30')}
                    onClick={() =>
                      setExpandedKey((current) =>
                        current === row.attemptKey ? null : row.attemptKey,
                      )
                    }
                  >
                    <TableCell>
                      <StatusBadge status={row.attempt.currentStatus} />
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
                      <span className="text-xs text-muted-foreground">{row.emailType ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{row.bookingReference ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{row.customerName ?? '—'}</span>
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
                              disabled={retryingAttemptKeys.has(row.attemptKey)}
                              aria-label={`Retry email for ${row.recipientEmail}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onRetryAttempt(row.attemptKey);
                              }}
                            >
                              <RotateCcw data-icon="inline-start" aria-hidden />
                              {retryingAttemptKeys.has(row.attemptKey) ? 'Sending…' : 'Retry'}
                            </Button>
                          ) : null}
                          <ChevronDown
                            className={cn(
                              'size-3 text-muted-foreground transition-transform',
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
                  nodes.push(
                    <TableRow key={`${row.attemptKey}__detail`} className="hover:bg-transparent">
                      <TableCell colSpan={7} className="p-0">
                        <AttemptDetail row={row} timezone={timezone} restaurantId={restaurantId} />
                      </TableCell>
                    </TableRow>,
                  );
                }
                return nodes;
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {shouldShowPagination ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Text variant="label">
              Showing {startResult}-{endResult} of {totalResults} results
            </Text>
            <Text variant="caption">Page {currentPage}</Text>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Text as="span" variant="caption">Rows per page</Text>
              <Select
                value={String(currentPageSize)}
                onValueChange={(value) => {
                  const next = Number.parseInt(value, 10);
                  if (Number.isFinite(next)) onPageSizeChange(next);
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-[88px]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPS_EMAIL_DELIVERY_PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrevPage}>
                <ChevronLeft data-icon="inline-start" aria-hidden />
                Prev
              </Button>
              <Text as="span" variant="caption" className="min-w-16 text-center">
                Page {currentPage}
              </Text>
              <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNextPage}>
                Next
                <ChevronRight data-icon="inline-end" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={isRetryDialogOpen} onOpenChange={onRetryDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry email delivery?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends the original email to the recipient again, right now. Use retry only for
              failed or bounced emails.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingRetryRow ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <div>
                <p className="font-medium text-foreground">Recipient</p>
                <p className="text-muted-foreground">{pendingRetryRow.recipientEmail}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Subject</p>
                <p className="text-muted-foreground">{pendingRetryRow.subject}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Email type</p>
                <p className="text-muted-foreground">{pendingRetryRow.emailType ?? '—'}</p>
              </div>
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-foreground">
                Warning: retrying will create a new delivery attempt and may send a duplicate email
                if the original eventually succeeds.
              </p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirmingRetry}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void onConfirmRetry();
              }}
              disabled={!pendingRetryRow || isConfirmingRetry}
            >
              {isConfirmingRetry ? 'Sending…' : 'Confirm Retry'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function AttemptDetail({
  row,
  timezone,
  restaurantId,
}: {
  row: OpsEmailDeliveryTableRowViewModel;
  timezone: string;
  restaurantId: string;
}) {
  const attempt = row.attempt;
  const errorEvent = attempt.events.find((event) => event.error);

  return (
    <div className="flex flex-col gap-4 px-2 py-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Message ID
          </div>
          <div
            className="max-w-full break-all font-mono text-xs text-muted-foreground"
            title={attempt.messageId}
          >
            {attempt.messageId}
          </div>
        </div>
        <CopyButton text={attempt.messageId} label="message id" variant="outline" size="sm" />
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

      {errorEvent?.error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-destructive">
            Error
          </div>
          <div className="text-xs text-destructive">{errorEvent.error}</div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Event Timeline
        </div>
        <div className="flex flex-col gap-1.5">
          {attempt.events.map((event) => (
            <div key={event.id} className="flex items-center gap-2 text-xs">
              <StatusBadge status={event.status} />
              <span className="text-muted-foreground">
                {formatEmailDeliveryOccurredAt(event.occurredAt, timezone) ?? event.occurredAt}
              </span>
              {event.error ? (
                <span className="truncate text-destructive" title={event.error}>
                  {event.error}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
