'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, Copy } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

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

import type { EmailDeliveryStatus, OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

// --- Sorting types ---

type SortColumn = 'sentAt' | 'status';
type SortDirection = 'asc' | 'desc';

type SortState = {
  column: SortColumn;
  direction: SortDirection;
};

// --- Status sort order (for deterministic sorting) ---

const STATUS_SORT_ORDER: Record<EmailDeliveryStatus, number> = {
  delivered: 0,
  sent: 1,
  delivery_delayed: 2,
  bounced: 3,
  complained: 4,
  failed: 5,
};

// --- Helpers ---

function parseIsoMs(value: string | null): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function resolveSubject(attempt: OpsEmailDeliveryAttemptDTO): string {
  for (const event of attempt.events) {
    const meta = event.metadata;
    if (!meta || typeof meta !== 'object') continue;
    const subject = (meta as { subject?: unknown }).subject;
    if (typeof subject === 'string' && subject.trim().length > 0) {
      return subject.trim();
    }
  }
  return attempt.templateType ?? attempt.emailType ?? 'Email';
}

function attemptKey(attempt: OpsEmailDeliveryAttemptDTO): string {
  return `${attempt.messageId}__${attempt.recipientEmail.toLowerCase()}`;
}

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
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // Fallback: ignore copy failures silently
      }
    },
    [text],
  );

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn('transition-all', copied && 'text-green-600')}
      aria-label="Copy message id"
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
      <span className="sr-only">{copied ? 'Copied!' : 'Copy message id'}</span>
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
}: {
  attempt: OpsEmailDeliveryAttemptDTO;
  timezone: string;
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
  attempts: OpsEmailDeliveryAttemptDTO[];
  timezone: string;
  restaurantId: string;
  isLoading: boolean;
};

export function OpsEmailDeliveryTable({
  attempts,
  timezone,
  restaurantId: _restaurantId,
  isLoading,
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

  const sortedAttempts = useMemo(() => {
    const sorted = [...attempts];
    sorted.sort((a, b) => {
      const dir = sortState.direction === 'asc' ? 1 : -1;
      if (sortState.column === 'sentAt') {
        const aMs = parseIsoMs(a.currentOccurredAt);
        const bMs = parseIsoMs(b.currentOccurredAt);
        if (aMs !== bMs) return (aMs - bMs) * dir;
        return a.messageId.localeCompare(b.messageId) * dir;
      }
      // Sort by status
      const aOrder = STATUS_SORT_ORDER[a.currentStatus] ?? 99;
      const bOrder = STATUS_SORT_ORDER[b.currentStatus] ?? 99;
      if (aOrder !== bOrder) return (aOrder - bOrder) * dir;
      // Tiebreak by sentAt desc
      return (parseIsoMs(b.currentOccurredAt) - parseIsoMs(a.currentOccurredAt));
    });
    return sorted;
  }, [attempts, sortState]);

  if (isLoading && attempts.length === 0) {
    return <TableLoadingSkeleton />;
  }

  if (!isLoading && attempts.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200/60 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">No email attempts in this time range.</p>
      </div>
    );
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
          {sortedAttempts.flatMap((attempt) => {
            const key = attemptKey(attempt);
            const isExpanded = expandedKey === key;
            const subject = resolveSubject(attempt);
            const when = formatEmailDeliveryOccurredAt(attempt.currentOccurredAt, timezone);

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
                  <span className="truncate text-sm font-medium" title={subject}>
                    {subject}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="truncate text-xs" title={attempt.recipientEmail}>
                    {attempt.recipientEmail}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {attempt.emailType ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">
                    {attempt.booking?.reference ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">
                    {attempt.booking?.customerName ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {when ?? '—'}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </div>
                </TableCell>
              </TableRow>,
            ];

            if (isExpanded) {
              rows.push(
                <TableRow key={`${key}__detail`} className="hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0">
                    <ExpandedRowDetail attempt={attempt} timezone={timezone} />
                  </TableCell>
                </TableRow>,
              );
            }

            return rows;
          })}
        </TableBody>
      </Table>
    </div>
  );
}
