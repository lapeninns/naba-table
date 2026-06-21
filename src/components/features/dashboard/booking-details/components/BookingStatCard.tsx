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
          ? 'bg-primary/10 border-primary/30 hover:bg-primary/10'
          : 'border-border bg-background/80 hover:bg-muted/40',
        className,
      )}
    >
      <div
        className={cn(
          'h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset',
          highlight
            ? 'bg-primary/10 text-primary ring-primary/30'
            : 'bg-muted/80 text-muted-foreground ring-border',
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
          {label}
        </span>
        <span
          className={cn('font-bold text-foreground', variant === 'compact' ? 'text-lg' : 'text-xl')}
        >
          {value}
        </span>
        {subtext ? <span className="text-xs text-muted-foreground">{subtext}</span> : null}
      </div>
    </div>
  );
}
