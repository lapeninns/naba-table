'use client';

import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type StatTileProps = {
  value: ReactNode;
  suffix?: ReactNode;
  label?: string;
  detail?: string;
  tone?: 'primary' | 'default';
  className?: string;
};

/** Operational-cockpit metric: a large tabular mono numeral over a muted label. */
export function StatTile({ value, suffix, label, detail, tone = 'primary', className }: StatTileProps) {
  const valueColor = tone === 'primary' ? 'text-primary' : 'text-foreground';
  return (
    <div className={cn('flex min-w-[140px] flex-col gap-1 rounded-md border border-border bg-card p-4', className)}>
      <div className="flex items-baseline gap-0.5">
        <span className={cn('font-mono text-3xl font-semibold leading-none tabular-nums', valueColor)}>
          {value}
        </span>
        {suffix ? (
          <span className={cn('font-mono text-base font-semibold', valueColor)}>{suffix}</span>
        ) : null}
      </div>
      {label ? <span className="text-sm font-medium text-foreground">{label}</span> : null}
      {detail ? <span className="text-[13px] text-muted-foreground">{detail}</span> : null}
    </div>
  );
}
