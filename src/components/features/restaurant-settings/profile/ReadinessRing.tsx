'use client';

import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import { getReadinessRingTheme, getReadinessTier } from './profileReadinessTheme';

type ReadinessRingProps = {
  /** Percent complete, 0-100. */
  value: number;
  /** Total items represented (for the inner caption). */
  total: number;
  /** Items completed (for the inner caption). */
  completed: number;
  /** Pixel size of the ring; default 82. */
  size?: number;
  /** Stroke width in pixels; default 6.5. */
  stroke?: number;
  className?: string;
};

/**
 * Circular completion gauge for the profile status bar. Uses non-punitive
 * palettes: warning → primary → success as completion rises.
 */
export function ReadinessRing({
  value,
  total,
  completed,
  size = 82,
  stroke = 6.5,
  className,
}: ReadinessRingProps) {
  const safeValue = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 100);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;
  const theme = useMemo(
    () => getReadinessRingTheme(getReadinessTier(safeValue)),
    [safeValue],
  );

  return (
    <div
      role="img"
      aria-label={`Profile readiness ${Math.round(safeValue)}%, ${completed} of ${total} fields complete`}
      className={cn(
        'relative inline-flex items-center justify-center motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:scale-[1.03]',
        className,
      )}
      style={{ width: size, height: size, filter: `drop-shadow(0 0 8px ${theme.glow})` }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="-rotate-90 select-none"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className={cn('transition-colors duration-300', theme.track)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-out',
            theme.stroke,
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none" aria-hidden>
        <span
          className={cn(
            'text-lg font-bold tabular-nums leading-none tracking-tight',
            theme.text,
          )}
        >
          {Math.round(safeValue)}
          <span className="ml-0.5 text-[10px] font-semibold">%</span>
        </span>
        <span className="mt-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
    </div>
  );
}
