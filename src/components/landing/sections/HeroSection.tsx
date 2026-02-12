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
    <section
      id="hero"
      className="relative pt-32 pb-20 px-6 border-b border-slate-200 overflow-hidden bg-white"
    >
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-20 w-[800px] h-[800px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none motion-safe:animate-float-slow" />

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
        <div className="space-y-8 text-center lg:text-left motion-safe:reveal-up motion-safe:active">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <Badge
              variant="secondary"
              className="bg-blue-50 text-blue-700 ring-1 ring-blue-700/10 hover:bg-blue-100 transition-colors"
            >
              {HERO_BADGE}
            </Badge>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              Only 1 Spot Left for January
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl text-slate-900 font-extrabold tracking-tight leading-[1.1]">
            The Zero-Risk No-Show <br />
            <span className="bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 bg-clip-text text-transparent bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite]">
              Lockdown System
            </span>{' '}
            for Food-Led UK Pubs
            <br />
          </h1>

          <p className="text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
            Using Nab a Table is like moving from a manual bicycle to a self-driving car. Set your
            destination (more profit) and let the system navigate the traffic of bookings for you.
          </p>

          <div className="flex flex-wrap justify-center lg:justify-start gap-4">
            <Button
              variant="outline"
              size="lg"
              className="bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
              asChild
            >
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>

        <div className="relative motion-safe:reveal-up motion-safe:active motion-safe:delay-100 lg:pl-10">
          <LiveFeedCard reduceMotion={reduceMotion} />
          <div className="absolute -bottom-6 -left-6 bg-slate-900 p-4 rounded-xl shadow-2xl border border-slate-800 hidden sm:block motion-safe:animate-bounce-slow max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div className="font-mono text-xs text-green-300">Revenue Optimized</div>
            </div>
            <div className="font-mono text-[12px] text-white font-bold leading-relaxed">
              +£4,250/mo Extra Profit
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
