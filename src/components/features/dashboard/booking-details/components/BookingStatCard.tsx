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
        'flex items-center gap-4 rounded-2xl border shadow-sm transition-colors',
        variant === 'compact' ? 'p-3' : 'p-4',
        highlight
          ? 'bg-amber-50/70 border-amber-200/70 hover:bg-amber-50'
          : 'bg-white/80 border-stone-200/70 hover:bg-stone-50/70',
        className,
      )}
    >
      <div
        className={cn(
          'h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset',
          highlight
            ? 'bg-amber-100/80 text-amber-700 ring-amber-200/70'
            : 'bg-stone-100/80 text-stone-600 ring-stone-200/70',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em]">{label}</span>
        <span className={cn('font-bold text-stone-900', variant === 'compact' ? 'text-lg' : 'text-xl')}>
          {value}
        </span>
        {subtext ? <span className="text-xs text-stone-500">{subtext}</span> : null}
      </div>
    </div>
  );
}
