/**
 * SelectableTableCard Component
 *
 * Single Responsibility: Display a clickable table card for selection
 */

'use client';

import { AlertTriangle, Check, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { getCapacityFit, getCapacityFitLabel } from '../utils';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

export interface SelectableTableCardProps {
  table: ManualAssignmentTable;
  partySize: number;
  isSelected: boolean;
  isAssigned: boolean;
  isConflicted: boolean;
  onToggle: () => void;
  disabled: boolean;
}

export function SelectableTableCard({
  table,
  partySize,
  isSelected,
  isAssigned,
  isConflicted,
  onToggle,
  disabled,
}: SelectableTableCardProps) {
  const isUnavailable = isConflicted || !table.active || table.status !== 'available';
  const fit = getCapacityFit(partySize, table);

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isUnavailable || isAssigned}
      aria-pressed={isSelected}
      className={cn(
        'group relative flex flex-col items-start justify-between p-3 text-left touch-manipulation',
        'min-h-[110px] rounded-xl border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      <div className="flex w-full items-start justify-between">
        <div>
          <span className={cn('text-base font-semibold text-slate-800', isAssigned && 'text-emerald-700')}>
            Table {table.tableNumber}
          </span>
          {table.name ? <div className="text-xs text-slate-500">{table.name}</div> : null}
        </div>
        {isConflicted ? (
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Conflict
          </Badge>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <Users className="h-3.5 w-3.5 text-slate-400" />
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
    </button>
  );
}
