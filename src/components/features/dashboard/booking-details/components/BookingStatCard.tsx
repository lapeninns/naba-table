/**
 * BookingStatCard Component
 *
 * Single Responsibility: Display a booking statistic with icon and value
 */

'use client';

import { cn } from '@/lib/utils';

import type { ElementType } from 'react';

export interface BookingStatCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
  variant?: 'default' | 'compact';
  className?: string;
}

export function BookingStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  highlight = false,
  variant = 'default',
  className,
}: BookingStatCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border transition-all',
        variant === 'compact' ? 'p-3' : 'p-4',
        highlight
          ? 'bg-blue-50/50 border-blue-200 hover:bg-blue-50'
          : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50',
        className,
      )}
    >
      <div
        className={cn(
          'h-11 w-11 rounded-xl flex items-center justify-center shrink-0',
          highlight ? 'bg-blue-100 text-blue-600' : 'bg-white text-slate-500 shadow-sm',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className={cn('font-bold text-slate-900 truncate', variant === 'compact' ? 'text-lg' : 'text-xl')}>
          {value}
        </span>
        {subtext ? <span className="text-xs text-slate-500">{subtext}</span> : null}
      </div>
    </div>
  );
}
