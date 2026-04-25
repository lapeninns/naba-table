'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { LiveFeedCard } from '../shared/LiveFeedCard';

const HERO_BADGE = 'Built for food-led UK pubs';

const HERO_STATUS = [
  ['42', 'covers protected tonight'],
  ['08', 'manual chases removed'],
  ['2', 'setup spots open'],
] as const;

const SHIFT_SIGNALS = [
  { label: 'No-show risk', value: 'Handled', tone: 'primary' },
  { label: 'Service pressure', value: 'Balanced', tone: 'neutral' },
  { label: 'Guest reminders', value: 'Sending', tone: 'primary' },
] as const;

interface HeroSectionProps {
  reduceMotion: boolean;
}

export function HeroSection({ reduceMotion }: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="relative isolate min-h-[100dvh] overflow-hidden border-b border-border/70 bg-background pt-[clamp(6.5rem,12vw,10rem)]"
    >
      <div
        className={cn(
          'pointer-events-none absolute -translate-y-1/2 translate-x-1/4 rounded-full bg-primary/[0.09] blur-3xl motion-safe:animate-float-slow',
          'right-0 top-16 size-[min(100vw,28rem)] sm:top-20 sm:size-[min(100vw,36rem)] md:size-[min(100vw,48rem)] lg:top-24 lg:size-[40rem] xl:size-[50rem] 2xl:right-8 2xl:size-[800px]',
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(9_9_11/0.028)_1px,transparent_1px),linear-gradient(90deg,rgb(9_9_11/0.028)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent,hsl(var(--muted)/0.72))]" />

      <div className="pg-container relative z-10 grid min-w-0 items-start gap-7 pb-[clamp(3rem,8vw,6rem)] sm:gap-9 md:gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 xl:gap-14">
        <div className="min-w-0 flex flex-col gap-5 text-center sm:gap-6 md:gap-7 motion-safe:reveal-up motion-safe:active lg:pt-6 lg:text-left">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3 lg:justify-start">
            <Badge variant="guest-chip" className="pg-chip w-fit">
              {HERO_BADGE}
            </Badge>
            <Badge variant="guest-chip-outline" className="pg-chip w-fit text-xs font-semibold">
              White-Glove setup included
            </Badge>
          </div>

          <h1 className="pg-hero-title">
            <span className="block">Nabatable keeps your pub service full, confirmed,</span>{' '}
            <span className="block text-primary">and under control.</span>
          </h1>

          <p className="pg-lead mx-auto max-w-xl lg:mx-0">
            A booking, reminder, floor-control, and manager visibility system for food-led pubs that
            cannot afford empty tables or chaotic Saturday nights.
          </p>

          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {HERO_STATUS.map(([value, label]) => (
              <div
                key={label}
                className="rounded-[var(--pg-radius-md)] border border-border/70 bg-background/82 p-3 shadow-[var(--pg-shadow-xs)] backdrop-blur-sm"
              >
                <p className="font-[var(--pg-font-mono)] text-xl font-semibold tabular-nums text-primary">
                  {value}
                </p>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col flex-wrap items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4 lg:justify-start">
            <Button
              variant="guest-primary"
              size="guest-lg"
              className="pg-action h-auto min-h-11 w-full max-w-[16rem] self-center whitespace-normal py-3 text-center leading-tight sm:w-auto sm:max-w-none sm:self-auto"
              asChild
            >
              <Link href="/contact">Claim a setup slot</Link>
            </Button>
            <Button
              variant="guest-outline"
              size="guest-lg"
              className="pg-action w-full max-w-[16rem] self-center sm:w-auto sm:max-w-none sm:self-auto"
              asChild
            >
              <Link href="#system">See the system</Link>
            </Button>
          </div>
        </div>

        <div className="relative min-w-0 motion-safe:reveal-up motion-safe:active motion-safe:delay-100 lg:pl-4 xl:pl-8 2xl:pl-10">
          <div className="pg-glass-frame mb-4 overflow-hidden p-3 backdrop-blur-md sm:mb-5 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="pg-kicker">Operational cockpit</p>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  A live view of bookings, floor pressure, and guest prompts before service starts.
                </p>
              </div>
              <div className="grid gap-2">
                {SHIFT_SIGNALS.map((signal) => (
                  <div
                    key={signal.label}
                    className="flex items-center justify-between gap-3 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground">{signal.label}</span>
                    <span
                      className={cn(
                        'font-[var(--pg-font-mono)] font-semibold uppercase tracking-[0.16em]',
                        signal.tone === 'primary' ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {signal.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <LiveFeedCard reduceMotion={reduceMotion} />
          <div className="pg-panel absolute -bottom-4 -left-2 hidden max-w-[min(100vw,20rem)] border-primary/15 bg-background/96 p-3 text-card-foreground shadow-[var(--pg-shadow-md)] sm:-bottom-6 sm:-left-4 sm:block sm:p-4 md:max-w-xs">
            <div className="mb-2 flex items-center gap-2">
              <div
                className={cn(
                  'size-2 rounded-full bg-primary',
                  reduceMotion ? '' : 'animate-pulse',
                )}
              />
              <div className="font-mono text-xs text-muted-foreground">Service protected</div>
            </div>
            <div className="font-mono text-xs font-bold leading-relaxed sm:text-[12px]">
              Every guest gets the right prompt before the table is lost.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
