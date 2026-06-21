'use client';

import { cn } from '@/lib/utils';

import { TONE_DOT, TONE_TEXT } from './serviceStateStyles';

import type { ServiceStateTone } from './domain/types';

export type StatusDotProps = {
  label?: string;
  tone?: ServiceStateTone;
  pulse?: boolean;
  className?: string;
};

/** A small dot + uppercase mono label for live service/system state. */
export function StatusDot({ label, tone = 'primary', pulse = false, className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative inline-flex h-2 w-2">
        {pulse ? (
          <span
            className={cn('absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping', TONE_DOT[tone])}
          />
        ) : null}
        <span className={cn('relative h-2 w-2 rounded-full', TONE_DOT[tone])} />
      </span>
      {label ? (
        <span
          className={cn(
            'font-mono text-[11px] font-semibold uppercase tracking-[0.16em]',
            TONE_TEXT[tone],
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
