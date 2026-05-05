/**
 * ArrivalCountdown
 *
 * Displays arrival timing based on booking time + status.
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { formatCountdown, getMinutesUntilTime, shouldShowCountdown } from '../utils';

import type { OpsBookingStatus } from '@/types/ops';
import type { DateTime } from 'luxon';

export interface ArrivalCountdownProps {
  status: OpsBookingStatus;
  startTime: string | null;
  date: string | null;
  timezone: string;
  now?: DateTime;
  compact?: boolean;
}

export function ArrivalCountdown({
  status,
  startTime,
  date,
  timezone,
  now,
  compact = false,
}: ArrivalCountdownProps) {
  const minutesRemaining = getMinutesUntilTime(startTime, date, timezone, now);
  if (!shouldShowCountdown(status, minutesRemaining)) return null;
  if (minutesRemaining === null) return null;

  const isLate = minutesRemaining < 0;
  const isImminent = minutesRemaining >= 0 && minutesRemaining <= 15;

  return (
    <Badge
      variant="secondary"
      className={cn(
        'flex items-center gap-2 uppercase tracking-wider',
        compact ? 'px-2 py-1 text-[10px] font-bold' : 'px-3 py-1 text-[11px] font-semibold',
        isLate
          ? 'bg-destructive/10 text-destructive'
          : isImminent
            ? cn(
                'bg-primary/10 text-primary',
                !compact && 'animate-pulse motion-reduce:animate-none',
              )
            : 'bg-muted/40 text-muted-foreground',
      )}
      role="status"
      aria-live="polite"
    >
      <span className={cn('relative flex', compact ? 'h-1.5 w-1.5' : 'h-2 w-2')}>
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-60',
            isLate ? 'bg-destructive' : isImminent ? 'bg-primary' : 'bg-muted-foreground',
          )}
        />
        <span
          className={cn(
            'relative inline-flex rounded-full',
            compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
            isLate ? 'bg-destructive' : isImminent ? 'bg-primary' : 'bg-muted-foreground',
          )}
        />
      </span>
      {isLate
        ? `Late ${formatCountdown(minutesRemaining)}`
        : compact
          ? formatCountdown(minutesRemaining)
          : `Arriving in ${formatCountdown(minutesRemaining)}`}
    </Badge>
  );
}
