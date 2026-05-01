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
}

export function ArrivalCountdown({
  status,
  startTime,
  date,
  timezone,
  now,
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
        'flex items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider',
        isLate
          ? 'bg-destructive/10 text-destructive'
          : isImminent
            ? 'bg-primary/10 text-primary animate-pulse motion-reduce:animate-none'
            : 'bg-muted/40 text-muted-foreground',
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-60',
            isLate ? 'bg-destructive/10' : isImminent ? 'bg-primary/10' : 'bg-primary/10',
          )}
        />
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            isLate ? 'bg-destructive/10' : isImminent ? 'bg-primary/10' : 'bg-primary/10',
          )}
        />
      </span>
      {isLate
        ? `Late by ${formatCountdown(minutesRemaining)}`
        : `Arriving in ${formatCountdown(minutesRemaining)}`}
    </Badge>
  );
}
