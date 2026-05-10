/**
 * SelectableTableCard Component
 *
 * Single Responsibility: Display a clickable table card for selection
 */

'use client';

import { AlertTriangle, Check, Users } from 'lucide-react';
import { memo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { getCapacityFit, getCapacityFitLabel } from '../utils';

import type { ManualAssignmentTable } from '@/services/ops/bookings';
import type { KeyboardEventHandler, Ref } from 'react';

export interface SelectableTableCardProps {
  tableId: string;
  table: ManualAssignmentTable;
  partySize: number;
  isSelected: boolean;
  isAssigned: boolean;
  isConflicted: boolean;
  onToggle: (tableId: string) => void;
  disabled: boolean;
  tabIndex?: number;
  onFocus?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  describedById?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  bookingStartTime?: string | null;
  bookingEndTime?: string | null;
  serviceWindowStart?: string | null;
  serviceWindowEnd?: string | null;
  parsedBookingStart?: number | null;
  parsedBookingEnd?: number | null;
  parsedServiceStart?: number | null;
  parsedServiceEnd?: number | null;
}

export const SelectableTableCard = memo(function SelectableTableCard({
  tableId,
  table,
  partySize,
  isSelected,
  isAssigned,
  isConflicted,
  onToggle,
  disabled,
  tabIndex,
  onFocus,
  onKeyDown,
  describedById,
  buttonRef,
  bookingStartTime,
  bookingEndTime,
  serviceWindowStart,
  serviceWindowEnd,
  parsedBookingStart,
  parsedBookingEnd,
  parsedServiceStart,
  parsedServiceEnd,
}: SelectableTableCardProps) {
  const isUnavailable = isConflicted || !table.active || table.status !== 'available';
  const fit = getCapacityFit(partySize, table);
  const showTimeline = table.status === 'conflicted' || isConflicted;
  const conflictTone = table.status === 'conflicted' || isConflicted;
  const handleToggle = () => onToggle(tableId);

  const parseTimeMinutes = (value?: string | null) => {
    if (!value) return null;
    const timePart = value.includes('T') ? value.split('T')[1] : value;
    const match = timePart.match(/(\d{2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  let bookingStart: number | null = null;
  let blockLeft = 0;
  let blockWidth = 0;

  if (showTimeline) {
    const defaultServiceStart = 18 * 60;
    const defaultServiceEnd = 22 * 60;
    const serviceStart =
      parsedServiceStart ?? parseTimeMinutes(serviceWindowStart) ?? defaultServiceStart;
    const serviceEnd = parsedServiceEnd ?? parseTimeMinutes(serviceWindowEnd) ?? defaultServiceEnd;
    bookingStart = parsedBookingStart ?? parseTimeMinutes(bookingStartTime);
    const bookingEnd = parsedBookingEnd ?? parseTimeMinutes(bookingEndTime);
    const serviceDuration = Math.max(1, serviceEnd - serviceStart);
    const rawStart = bookingStart ?? serviceStart;
    const rawEnd = bookingEnd && bookingEnd > rawStart ? bookingEnd : rawStart + 60;
    const clampedStart = Math.min(Math.max(rawStart, serviceStart), serviceEnd);
    const clampedEnd = Math.min(Math.max(rawEnd, serviceStart), serviceEnd);
    blockLeft = ((clampedStart - serviceStart) / serviceDuration) * 100;
    blockWidth = Math.max(8, ((clampedEnd - clampedStart) / serviceDuration) * 100);
  }

  const srSummary =
    `Table ${table.tableNumber}. ` +
    `${table.capacity} seats. ` +
    (table.section ? `Section ${table.section}. ` : '') +
    `${getCapacityFitLabel(fit)} fit. ` +
    (isAssigned
      ? 'Already assigned.'
      : isUnavailable
        ? isConflicted
          ? 'Unavailable due to a conflict.'
          : 'Unavailable.'
        : 'Available.');

  return (
    <Button
      type="button"
      variant="ghost"
      ref={buttonRef}
      onClick={handleToggle}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      disabled={disabled || isUnavailable || isAssigned}
      aria-pressed={isSelected}
      aria-describedby={describedById}
      tabIndex={tabIndex}
      className={cn(
        // w-full + flex-1: fill grid cell (inline-flex default was shrink-wrapped vs column width).
        // justify-start: override Button’s justify-center so extra row height doesn’t float content.
        'group relative flex h-full min-h-0 w-full flex-1 flex-col items-start justify-start gap-2 whitespace-normal p-2.5 text-left touch-manipulation',
        'rounded-xl border transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isAssigned
          ? 'cursor-default border-primary/40 bg-primary/5 shadow-sm'
          : isSelected
            ? 'border-primary bg-primary/10 shadow-md scale-[1.02] ring-1 ring-primary/20'
            : isUnavailable
              ? 'cursor-not-allowed border-border bg-muted/20 opacity-60'
              : 'cursor-pointer border-border/60 bg-background hover:border-primary/40 hover:bg-muted/5',
      )}
    >
      {(isSelected || isAssigned) && (
        <div
          className={cn(
            'absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border shadow-md transition-transform',
            isAssigned ? 'bg-primary scale-110' : 'bg-primary scale-100',
          )}
        >
          <Check className="size-3 text-primary-foreground" aria-hidden />
        </div>
      )}

      <div className="flex w-full items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
            {table.section || 'General'}
          </div>
          <span
            className={cn(
              'block break-words text-sm font-bold tracking-tight text-foreground leading-tight',
              isAssigned && 'text-primary',
            )}
          >
            {table.tableNumber}
          </span>
          {table.name ? (
            <div className="mt-0.5 break-words text-[10px] font-medium text-muted-foreground/70">
              {table.name}
            </div>
          ) : null}
        </div>
        {isConflicted && (
          <div className="shrink-0 flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-destructive">
            <AlertTriangle className="size-2.5" />
            Busy
          </div>
        )}
      </div>

      <div className="w-full">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-sm bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
            <Users className="size-2.5" />
            {table.capacity}
          </div>
          <Badge
            variant="secondary"
            className={cn(
              'h-4 px-1 text-[9px] font-bold uppercase tracking-wider',
              fit === 'exact' || fit === 'within'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-muted/40 text-muted-foreground border-border/50',
            )}
          >
            {getCapacityFitLabel(fit)}
          </Badge>
        </div>

        {showTimeline && (
          <div className="mt-3 space-y-1.5">
            <div
              className={cn(
                'relative h-1.5 w-full overflow-hidden rounded-full border',
                conflictTone
                  ? 'border-destructive/20 bg-destructive/5'
                  : 'border-border/40 bg-muted/20',
              )}
              aria-hidden
            >
              {bookingStart !== null && (
                <div
                  className={cn(
                    'absolute top-0 h-full rounded-full transition-all',
                    conflictTone ? 'bg-destructive' : 'bg-primary',
                  )}
                  style={{ left: `${blockLeft}%`, width: `${blockWidth}%` }}
                  aria-hidden
                />
              )}
            </div>
            <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">
              <span>{conflictTone ? 'Conflict' : 'Occupied'}</span>
              <span>{Math.round(blockWidth)}%</span>
            </div>
          </div>
        )}
      </div>

      {describedById ? (
        <span id={describedById} className="sr-only">
          {srSummary}
        </span>
      ) : null}
    </Button>
  );
});
