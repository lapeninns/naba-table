'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { LiveFeedCard } from '../shared/LiveFeedCard';

const HERO_BADGE = "The 'Category of One' Growth System for UK Pubs";

interface HeroSectionProps {
  reduceMotion: boolean;
}

export function HeroSection({ reduceMotion }: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="pg-section relative overflow-hidden border-b border-border/70 bg-background pt-[clamp(6rem,12vw,10rem)]"
    >
      <div
        className={cn(
          'pointer-events-none absolute -translate-y-1/2 translate-x-1/4 rounded-full bg-primary/10 blur-3xl motion-safe:animate-float-slow',
          'right-0 top-16 size-[min(100vw,28rem)] sm:top-20 sm:size-[min(100vw,36rem)] md:size-[min(100vw,48rem)] lg:top-24 lg:size-[40rem] xl:size-[50rem] 2xl:right-8 2xl:size-[800px]',
        )}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,hsl(var(--muted)/0.55))]" />

      <div className="pg-container relative z-10 grid min-w-0 items-start gap-6 sm:gap-8 md:gap-10 lg:grid-cols-[minmax(0,5.2fr)_minmax(0,6.8fr)] lg:gap-10 xl:gap-14">
        <div className="min-w-0 flex flex-col gap-5 text-center sm:gap-6 md:gap-7 motion-safe:reveal-up motion-safe:active lg:pt-4 lg:text-left">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3 lg:justify-start">
            <Badge variant="guest-chip" className="pg-chip w-fit">
              {HERO_BADGE}
            </Badge>
            <Badge variant="guest-chip-outline" className="pg-chip w-fit text-xs font-semibold">
              5 monthly setup spots
            </Badge>
          </div>

          <h1 className="pg-hero-title">
            <span className="block sm:inline sm:mr-1">
              The &apos;Packed House&apos; Pub System:
            </span>{' '}
            <span className="block text-primary sm:inline">Fill Your Tables</span>{' '}
            <span className="mt-1 block sm:mt-0 sm:inline">
              &amp; Eradicate No-Shows Without Lifting A Finger.
            </span>
          </h1>

          <p className="pg-lead mx-auto max-w-xl lg:mx-0">
            Stop chasing bookings and losing money to empty seats. Nabatable is the only all-in-one
            system that automates your reservations, eliminates seating chaos, and guarantees a
            calmer, more profitable service.
          </p>

          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {[
              ['5 monthly', 'setup spots'],
              ['£0', 'lost to no-shows'],
              ['White-Glove', 'setup included'],
            ].map(([value, label]) => (
              <div
                key={label}
                className="pg-panel rounded-[var(--pg-radius-lg)] border-border/70 bg-background/80 p-3 shadow-[var(--pg-shadow-xs)] backdrop-blur-sm"
              >
                <p className="font-[var(--pg-font-mono)] text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  {value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col flex-wrap items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4 lg:justify-start">
            <Button
              variant="guest-primary"
              size="guest-lg"
              className="h-auto min-h-11 w-full whitespace-normal py-3 text-center leading-tight sm:w-auto"
              asChild
            >
              <Link href="/contact">Claim one monthly setup spot</Link>
            </Button>
            <Button variant="guest-outline" size="guest-lg" className="w-full sm:w-auto" asChild>
              <Link href="#system">See How It Works</Link>
            </Button>
          </div>
        </div>

        <div className="relative min-w-0 motion-safe:reveal-up motion-safe:active motion-safe:delay-100 lg:pl-4 xl:pl-8 2xl:pl-10">
          <div className="pg-panel mb-4 rounded-[var(--pg-radius-xl)] border-primary/15 bg-muted/35 p-3 sm:mb-5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="pg-kicker">Operational cockpit</p>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  Same B2B promise, now framed in the guest-facing system.
                </p>
              </div>
              <Badge variant="metric" className="shrink-0">
                Live service
              </Badge>
            </div>
          </div>
          <LiveFeedCard reduceMotion={reduceMotion} />
          <div className="pg-panel absolute -bottom-4 -left-2 hidden max-w-[min(100vw,20rem)] border-primary/15 bg-background/96 p-3 text-card-foreground shadow-[var(--pg-shadow-soft)] motion-safe:animate-bounce-slow sm:-bottom-6 sm:-left-4 sm:block sm:p-4 md:max-w-xs">
            <div className="mb-2 flex items-center gap-2">
              <div className="size-2 animate-pulse rounded-full bg-primary" />
              <div className="font-mono text-xs text-muted-foreground">Service protected</div>
            </div>
            <div className="font-mono text-xs font-bold leading-relaxed sm:text-[12px]">
              Lost Revenue from No-Shows: £0
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
