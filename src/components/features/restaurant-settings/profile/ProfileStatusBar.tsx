'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ReadinessRing } from './ReadinessRing';

type ProfileStatusBarProps = {
  bookingSlug: string | null;
  readinessScore: number;
  readinessStageLabel: string;
  completedCount: number;
  totalCount: number;
  requiredRemainingCount: number;
  nextActionLabel: string | null;
  nextActionDescription: string;
  googleHint: string | null;
  googleHref: string;
  onJumpToBooking: () => void;
  onJumpToNextAction: (() => void) | null;
};

export function ProfileStatusBar({
  bookingSlug,
  readinessScore,
  readinessStageLabel,
  completedCount,
  totalCount,
  requiredRemainingCount,
  nextActionLabel,
  nextActionDescription,
  googleHint,
  googleHref,
  onJumpToBooking,
  onJumpToNextAction,
}: ProfileStatusBarProps) {
  const hasBookingSlug = typeof bookingSlug === 'string' && bookingSlug.trim().length > 0;
  const requiredCopy =
    requiredRemainingCount > 0
      ? `${requiredRemainingCount} required field${requiredRemainingCount === 1 ? '' : 's'} left`
      : 'Required fields complete';
  const canJumpToNextAction = Boolean(nextActionLabel && onJumpToNextAction);

  return (
    <section className="grid gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <ReadinessRing
        value={readinessScore}
        completed={completedCount}
        total={totalCount}
        size={72}
        stroke={6}
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{readinessStageLabel}</Badge>
          <span className="text-xs text-muted-foreground">{requiredCopy}</span>
        </div>
        <p className="mt-1 text-sm leading-6 text-foreground">{nextActionDescription}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{hasBookingSlug ? `/${bookingSlug}` : 'Missing booking URL'}</span>
          {googleHint ? <span>{googleHint}</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {canJumpToNextAction ? (
          <Button type="button" size="sm" onClick={onJumpToNextAction ?? undefined}>
            {nextActionLabel}
          </Button>
        ) : hasBookingSlug ? (
          <Button type="button" variant="ghost" size="sm" onClick={onJumpToBooking}>
            Review booking URL
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={onJumpToBooking}>
            Add booking URL
          </Button>
        )}
        {googleHint ? (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={googleHref}>Link Google</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
