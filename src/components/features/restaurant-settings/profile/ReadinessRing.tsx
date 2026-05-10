'use client';

import { cn } from '@/lib/utils';

type ReadinessRingProps = {
  /** Percent complete, 0-100. */
  value: number;
  /** Total items represented (for the inner caption). */
  total: number;
  /** Items completed (for the inner caption). */
  completed: number;
  /** Pixel size of the ring; default 96. */
  size?: number;
  /** Stroke width in pixels; default 8. */
  stroke?: number;
  className?: string;
};

/**
 * Circular completion indicator used in the Profile header. Values clamp to
 * 0–100. Accessible via `role="img"` + `aria-label`; the visible inner text is
 * marked aria-hidden to avoid double-announcement.
 */
export function ReadinessRing({
  value,
  total,
  completed,
  size = 96,
  stroke = 8,
  className,
}: ReadinessRingProps) {
  const safeValue = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 100);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;
  const isComplete = safeValue >= 100;
  const progressTone = isComplete
    ? 'text-primary'
    : safeValue >= 60
      ? 'text-warning'
      : 'text-destructive';

  return (
    <div
      role="img"
      aria-label={`Profile readiness ${Math.round(safeValue)}%, ${completed} of ${total} fields complete`}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className="text-muted/40"
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
          className={cn('transition-[stroke-dashoffset] duration-500 ease-out', progressTone)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="text-xl font-semibold tabular-nums leading-none text-foreground">
          {Math.round(safeValue)}%
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
    </div>
  );
}
