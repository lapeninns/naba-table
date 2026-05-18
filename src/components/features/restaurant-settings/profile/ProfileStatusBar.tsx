'use client';

import { ArrowRight, Check, Globe, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ReadinessRing } from './ReadinessRing';
import { getReadinessBarTheme, getReadinessTier } from './profileReadinessTheme';

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
  const canJumpToNextAction = Boolean(nextActionLabel && onJumpToNextAction);
  const tier = useMemo(() => getReadinessTier(readinessScore), [readinessScore]);
  const theme = useMemo(() => getReadinessBarTheme(tier), [tier]);

  const requiredCopy =
    requiredRemainingCount > 0
      ? `${requiredRemainingCount} action${requiredRemainingCount === 1 ? '' : 's'} required`
      : 'All prerequisites complete';

  return (
    <section
      className={cn(
        'relative flex w-full flex-col items-stretch justify-between gap-5 rounded-2xl border bg-card p-5 transition-all duration-300 md:flex-row md:items-center md:gap-6 md:p-6',
        theme.shell,
      )}
      style={{ boxShadow: `inset 0 1px 0 hsl(var(--background) / 0.65), 0 10px 40px -12px ${theme.glow}` }}
    >
      <div className="flex w-full min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-start md:w-auto">
        <div className="shrink-0">
          <ReadinessRing
            value={readinessScore}
            completed={completedCount}
            total={totalCount}
            size={82}
            stroke={6.5}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
            <span
              className={cn(
                'rounded border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest',
                theme.badge,
              )}
            >
              {readinessStageLabel}
            </span>

            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              {requiredRemainingCount > 0 ? (
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
              ) : (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-success/25 bg-success/10"
                  aria-hidden
                >
                  <Check className="size-2.5 text-success" />
                </span>
              )}
              {requiredCopy}
            </span>
          </div>

          <p className="max-w-xl text-[13px] font-normal leading-relaxed text-foreground/90 md:text-sm">
            {nextActionDescription}
          </p>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-muted-foreground">
              <Globe className="size-3 shrink-0 opacity-70" aria-hidden />
              <span className="font-mono text-[10px] tracking-wide">
                {hasBookingSlug ? `/${bookingSlug}` : 'Missing booking path'}
              </span>
            </div>

            {googleHint ? (
              <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-muted-foreground">
                <span
                  className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-[8px] font-black text-primary"
                  aria-hidden
                >
                  G
                </span>
                <span className="truncate text-[11px]">{googleHint}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center md:w-auto md:justify-end">
        {canJumpToNextAction ? (
          <Button
            type="button"
            size="sm"
            className="group h-9 rounded-md px-4 text-xs font-semibold shadow-md"
            onClick={onJumpToNextAction ?? undefined}
          >
            {nextActionLabel}
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        ) : hasBookingSlug ? (
          <Button type="button" variant="outline" size="sm" className="h-9 px-4 text-xs font-semibold" onClick={onJumpToBooking}>
            Review booking URL
          </Button>
        ) : (
          <Button type="button" size="sm" className="h-9 px-4 text-xs font-semibold shadow-md" onClick={onJumpToBooking}>
            <Sparkles className="size-3.5 text-warning" aria-hidden />
            Add booking URL
          </Button>
        )}

        {googleHint ? (
          <Button type="button" variant="ghost" size="sm" className="h-9 px-3 text-xs font-semibold text-muted-foreground" asChild>
            <Link href={googleHref}>Link Google</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
