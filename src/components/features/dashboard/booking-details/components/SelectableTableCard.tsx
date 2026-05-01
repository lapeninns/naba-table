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
        'group relative flex h-auto flex-col items-start justify-between whitespace-normal p-3 text-left touch-manipulation',
        'min-h-[110px] rounded-xl border transition-[transform,box-shadow,border-color,background-color,color] duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'motion-reduce:transition-none motion-reduce:transform-none',
        isAssigned
          ? 'cursor-default border-primary/30 bg-primary/10'
          : isSelected
            ? 'border-primary bg-primary/10 shadow-sm'
            : isUnavailable
              ? 'cursor-not-allowed border-border bg-muted opacity-60'
              : 'cursor-pointer border-border bg-background hover:border-primary/30 hover:shadow-sm',
      )}
    >
      {(isSelected || isAssigned) && (
        <div
          className={cn(
            'absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full shadow-sm',
            isAssigned ? 'bg-primary' : 'bg-primary',
          )}
        >
          <Check className="h-3 w-3 text-primary-foreground" aria-hidden />
        </div>
      )}

      <div className="flex w-full items-start justify-between">
        <div>
          <span
            className={cn('text-base font-semibold text-foreground', isAssigned && 'text-primary')}
          >
            Table {table.tableNumber}
          </span>
          {table.name ? (
            <div
              className="max-w-[10rem] truncate text-xs text-muted-foreground"
              title={table.name}
            >
              {table.name}
            </div>
          ) : null}
        </div>
        {isConflicted ? (
          <Badge variant="outline" className="border-border bg-muted/40 text-foreground">
            <AlertTriangle className="h-3 w-3 mr-1" aria-hidden />
            Conflict
          </Badge>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span>{table.capacity} seats</span>
        {table.section ? <span className="text-muted-foreground">· {table.section}</span> : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px]',
            fit === 'exact'
              ? 'bg-primary/10 text-primary'
              : fit === 'within'
                ? 'bg-primary/10 text-primary'
                : fit === 'oversized'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-destructive/10 text-destructive',
          )}
        >
          {getCapacityFitLabel(fit)}
        </Badge>
        {table.seatingType ? (
          <Badge variant="outline" className="text-[10px]">
            {table.seatingType}
          </Badge>
        ) : null}
        {table.mobility ? (
          <Badge variant="outline" className="text-[10px]">
            {table.mobility}
          </Badge>
        ) : null}
      </div>

      {showTimeline ? (
        <div className="mt-3 w-full">
          <div
            className={cn(
              'relative h-2 w-full rounded-full border',
              conflictTone ? 'border-destructive/20 bg-destructive/10' : 'border-border bg-muted',
            )}
            aria-hidden
          >
            {bookingStart !== null && (
              <div
                className="absolute top-0 h-full rounded-full bg-primary"
                style={{ left: `${blockLeft}%`, width: `${blockWidth}%` }}
                aria-hidden
              />
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{conflictTone ? 'Busy' : 'Unknown'}</span>
            {bookingStart !== null ? <span>Current booking</span> : null}
          </div>
        </div>
      ) : null}

      {describedById ? (
        <span id={describedById} className="sr-only">
          {srSummary}
        </span>
      ) : null}
    </Button>
  );
});
