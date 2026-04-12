'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { LiveFeedCard } from '../shared/LiveFeedCard';

const HERO_BADGE = 'Installed in 24 Hours';

interface HeroSectionProps {
  reduceMotion: boolean;
}

export function HeroSection({ reduceMotion }: HeroSectionProps) {
  return (
    <section id="hero" className="relative overflow-hidden border-b border-border px-6 pb-20 pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-20 h-[800px] w-[800px] -translate-y-1/2 translate-x-1/3 rounded-full bg-primary/10 blur-3xl motion-safe:animate-float-slow" />

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
        <div className="space-y-8 text-center lg:text-left motion-safe:reveal-up motion-safe:active">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <Badge
              variant="secondary"
              className="border border-primary/15 bg-primary/10 text-primary transition-colors hover:bg-primary/15"
            >
              {HERO_BADGE}
            </Badge>
            <span className="rounded-full border border-secondary-foreground/10 bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
              Only 1 Spot Left for January
            </span>
          </div>

          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            The Zero-Risk No-Show <br />
            <span className="animate-[shimmer_3s_linear_infinite] bg-gradient-to-r from-primary via-violet-400 to-primary bg-[length:200%_100%] bg-clip-text text-transparent">
              Lockdown System
            </span>{' '}
            for Food-Led UK Pubs
            <br />
          </h1>

          <p className="mx-auto max-w-xl text-lg font-medium leading-relaxed text-muted-foreground lg:mx-0">
            Using Nab a Table is like moving from a manual bicycle to a self-driving car. Set your
            destination (more profit) and let the system navigate the traffic of bookings for you.
          </p>

          <div className="flex flex-wrap justify-center lg:justify-start gap-4">
            <Button
              variant="outline"
              size="lg"
              className="rounded-4xl border-border bg-background text-foreground hover:bg-muted"
              asChild
            >
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>

        <div className="relative motion-safe:reveal-up motion-safe:active motion-safe:delay-100 lg:pl-10">
          <LiveFeedCard reduceMotion={reduceMotion} />
          <div className="absolute -bottom-6 -left-6 hidden max-w-xs rounded-[1.75rem] border border-primary/20 bg-foreground p-4 shadow-2xl motion-safe:animate-bounce-slow sm:block">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <div className="font-mono text-xs text-primary-foreground/70">Revenue Optimized</div>
            </div>
            <div className="font-mono text-[12px] font-bold leading-relaxed text-primary-foreground">
              +£4,250/mo Extra Profit
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
