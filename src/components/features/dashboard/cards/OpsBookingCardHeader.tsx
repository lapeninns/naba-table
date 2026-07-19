'use client';

import { Armchair, Calendar, Clock, FileText, Users } from 'lucide-react';
import { memo } from 'react';

import { BookingStatusBadge } from '@/components/features/booking-state-machine';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type {
  OpsBookingCardDetailsViewModel,
  OpsBookingCardHeaderViewModel,
} from './opsBookingCardUtils';
import type { OpsBookingStatus } from '@/types/ops';

export type OpsBookingCardHeaderProps = {
  header: OpsBookingCardHeaderViewModel;
  /** Table state forwarded from the details view-model so the chip can be rendered in the header. */
  table?: OpsBookingCardDetailsViewModel['table'];
  isOpen: boolean;
  /** @deprecated Chevron button is replaced by full-body tap on mobile; prop retained for API compat. */
  showCollapseToggle?: boolean;
  disableCollapseToggle?: boolean;
};

export const OpsBookingCardHeader = memo(function OpsBookingCardHeader({
  header,
  table,
  isOpen,
}: OpsBookingCardHeaderProps) {
  const {
    bookingId,
    status,
    customerLabel,
    initials,
    partySizeLabel,
    dateLabel,
    timeRangeLabel,
    isDone,
    hasNotes,
    urgency,
  } = header;

  return (
    <div className="p-3 pb-2 sm:p-4 sm:pb-3">
      {/* ── Row 1: Avatar + Name + Status badge ─────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0 sm:h-9 sm:w-9">
            <AvatarFallback
              className={cn(
                'text-[13px] font-semibold',
                isDone ? 'bg-muted/50 text-muted-foreground' : 'bg-muted/60 text-foreground/80',
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          <p
            id={`guest-name-${bookingId}`}
            className={cn(
              'line-clamp-1 text-[15px] font-semibold leading-tight sm:text-base',
              isDone
                ? 'text-muted-foreground line-through decoration-border/60'
                : 'text-foreground',
            )}
            title={customerLabel}
          >
            {customerLabel}
          </p>
        </div>

        {/* Status badge — always visible, right-aligned */}
        <div className="shrink-0">
          <BookingStatusBadge status={status as OpsBookingStatus} size="sm" showTooltip={false} />
        </div>
      </div>

      {/* ── Row 2: Party / Date / Time meta ─────────────────────────── */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[calc(2rem+0.625rem)] sm:pl-[calc(2.25rem+0.625rem)]">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
          <Users className="size-3 shrink-0" aria-hidden />
          {partySizeLabel}
        </span>
        <span className="text-[11px] text-muted-foreground/40" aria-hidden>
          ·
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
          <Calendar className="size-3 shrink-0" aria-hidden />
          {dateLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:text-[11px]">
          <Clock className="size-3 shrink-0" aria-hidden />
          {timeRangeLabel}
        </span>
      </div>

      {/* ── Row 3: Operational chips (table + urgency + notes pill) ──── */}
      {(table || urgency || (!isOpen && hasNotes)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[calc(2rem+0.625rem)] sm:pl-[calc(2.25rem+0.625rem)]">
          {/* Table chip — visible even before expanding */}
          {table && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium sm:text-[11px]',
                table.state === 'unassigned'
                  ? 'border border-warning/20 bg-warning/10 text-warning'
                  : 'bg-muted/50 text-foreground/70',
              )}
            >
              <Armchair className="size-3 shrink-0" aria-hidden />
              {table.label}
            </span>
          )}

          {/* Urgency badge */}
          {urgency && (
            <Badge
              variant={urgency.variant === 'destructive' ? 'destructive' : 'outline'}
              className={cn(
                'py-0.5 text-[10px] uppercase tracking-wider sm:text-xs',
                urgency.variant === 'warning' && 'border-primary/30 bg-primary/10 text-primary',
              )}
            >
              <Clock className="mr-1 size-3" aria-hidden /> {urgency.label}
            </Badge>
          )}

          {/* Notes passive signal — visible when collapsed */}
          {!isOpen && hasNotes && (
            <Badge variant="secondary" className="py-0.5 text-[10px] sm:text-[11px]">
              <FileText className="mr-1 size-3" aria-hidden />
              Notes
              <span className="sr-only"> available. Expand details to read.</span>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
});

OpsBookingCardHeader.displayName = 'OpsBookingCardHeader';
