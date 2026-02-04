/**
 * SelectableTableCard Component
 *
 * Single Responsibility: Display a clickable table card for selection
 */

'use client';

import { AlertTriangle, Check, Users } from 'lucide-react';
import { memo } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { getCapacityFit, getCapacityFitLabel } from '../utils';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

export interface SelectableTableCardProps {
  tableId: string;
  table: ManualAssignmentTable;
  partySize: number;
  isSelected: boolean;
  isAssigned: boolean;
  isConflicted: boolean;
  onToggle: (tableId: string) => void;
  disabled: boolean;
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

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled || isUnavailable || isAssigned}
      aria-pressed={isSelected}
      className={cn(
        'group relative flex flex-col items-start justify-between p-3 text-left touch-manipulation',
        'min-h-[110px] rounded-xl border transition-[transform,box-shadow,border-color,background-color,color] duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        isAssigned
          ? 'bg-emerald-50 border-emerald-300 cursor-default'
          : isSelected
            ? 'bg-blue-50 border-blue-400 shadow-sm'
            : isUnavailable
              ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
              : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm cursor-pointer',
      )}
    >
      {(isSelected || isAssigned) && (
        <div
          className={cn(
            'absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full shadow-sm',
            isAssigned ? 'bg-emerald-500' : 'bg-blue-500',
          )}
        >
          <Check className="h-3 w-3 text-white" aria-hidden />
        </div>
      )}

      <div className="flex w-full items-start justify-between">
        <div>
          <span
            className={cn(
              'text-base font-semibold text-slate-800',
              isAssigned && 'text-emerald-700',
            )}
          >
            Table {table.tableNumber}
          </span>
          {table.name ? <div className="text-xs text-slate-500">{table.name}</div> : null}
        </div>
        {isConflicted ? (
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
            <AlertTriangle className="h-3 w-3 mr-1" aria-hidden />
            Conflict
          </Badge>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        <span>{table.capacity} seats</span>
        {table.section ? <span className="text-slate-400">· {table.section}</span> : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px]',
            fit === 'exact'
              ? 'bg-emerald-50 text-emerald-700'
              : fit === 'within'
                ? 'bg-blue-50 text-blue-700'
                : fit === 'oversized'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-rose-50 text-rose-700',
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
              conflictTone ? 'bg-rose-100 border-rose-200' : 'bg-slate-100 border-slate-200',
            )}
          >
            {bookingStart !== null && (
              <div
                className="absolute top-0 h-full rounded-full bg-blue-500"
                style={{ left: `${blockLeft}%`, width: `${blockWidth}%` }}
                aria-label="Current booking"
              />
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
            <span>{conflictTone ? 'Busy' : 'Unknown'}</span>
            {bookingStart !== null ? <span>Current booking</span> : null}
          </div>
        </div>
      ) : null}
    </button>
  );
});
