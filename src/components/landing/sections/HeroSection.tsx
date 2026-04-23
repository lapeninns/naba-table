'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { LiveFeedCard } from '../shared/LiveFeedCard';

const HERO_BADGE = 'Installed in 24 Hours';

interface HeroSectionProps {
  reduceMotion: boolean;
}

export function HeroSection({ reduceMotion }: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="pg-section relative overflow-hidden border-b border-border bg-background pt-24 sm:pt-28 md:pt-32 lg:pt-36 xl:pt-40"
    >
      <div
        className={cn(
          'pointer-events-none absolute -translate-y-1/2 translate-x-1/4 rounded-full bg-primary/10 blur-3xl motion-safe:animate-float-slow',
          'right-0 top-16 size-[min(100vw,28rem)] sm:top-20 sm:size-[min(100vw,36rem)] md:size-[min(100vw,48rem)] lg:top-24 lg:size-[40rem] xl:size-[50rem] 2xl:right-8 2xl:size-[800px]',
        )}
      />

      <div className="pg-container relative z-10 grid items-center gap-8 sm:gap-10 md:gap-12 lg:grid-cols-[5fr_7fr] lg:gap-12 xl:gap-16">
        <div className="flex flex-col gap-6 text-center sm:gap-7 md:gap-8 motion-safe:reveal-up motion-safe:active lg:text-left">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3 lg:justify-start">
            <Badge variant="secondary" className="pg-chip w-fit">
              {HERO_BADGE}
            </Badge>
            <Badge variant="outline" className="pg-chip w-fit text-xs font-semibold">
              Only 1 spot left this month
            </Badge>
          </div>

          <h1 className="pg-hero-title">
            <span className="block sm:inline sm:mr-1">The zero-risk no-show</span>{' '}
            <span className="block text-primary sm:inline">lockdown system</span>{' '}
            <span className="mt-1 block sm:mt-0 sm:inline">for food-led UK pubs</span>
          </h1>

          <p className="pg-lead mx-auto max-w-xl lg:mx-0">
            Using Nab a Table is like moving from a manual bicycle to a self-driving car. Set your
            destination (more profit) and let the system navigate the traffic of bookings for you.
          </p>

          <div className="flex flex-col flex-wrap items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4 lg:justify-start">
            <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>

        <div className="relative motion-safe:reveal-up motion-safe:active motion-safe:delay-100 lg:pl-4 xl:pl-8 2xl:pl-10">
          <LiveFeedCard reduceMotion={reduceMotion} />
          <div className="pg-card absolute -bottom-4 -left-2 hidden max-w-[min(100vw,20rem)] p-3 text-card-foreground motion-safe:animate-bounce-slow sm:-bottom-6 sm:-left-4 sm:block sm:p-4 md:max-w-xs">
            <div className="mb-2 flex items-center gap-2">
              <div className="size-2 animate-pulse rounded-full bg-primary" />
              <div className="font-mono text-xs text-muted-foreground">Revenue optimized</div>
            </div>
            <div className="font-mono text-xs font-bold leading-relaxed sm:text-[12px]">
              +£4,250/mo extra profit
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
