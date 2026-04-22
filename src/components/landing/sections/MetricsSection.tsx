'use client';

import { MetricCard } from '../shared/MetricCard';

const METRICS = [
  {
    label: 'Added Revenue/Mo',
    value: 4200,
    prefix: '£',
    suffix: '+',
    detail: 'Proven Result',
    icon: 'chart' as const,
  },
  { label: 'Labor Hours Saved', value: 20, suffix: 'h+', detail: 'Per Week', icon: 'zap' as const },
];

interface MetricsSectionProps {
  reduceMotion: boolean;
}

export function MetricsSection({ reduceMotion }: MetricsSectionProps) {
  return (
    <section
      id="metrics"
      className="border-b border-border bg-muted/40 py-12 sm:py-16 md:py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-8 2xl:px-10">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 md:gap-8 lg:grid-cols-3 lg:gap-8 xl:gap-10">
          <div className="flex flex-col gap-3 sm:gap-4 md:max-w-md lg:max-w-none lg:justify-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">Numbers don&apos;t lie.</h2>
            <p className="text-base text-muted-foreground sm:text-lg">
              Stop guessing. See exactly how automated confirmations and waitlist monetization impact
              your bottom line.
            </p>
          </div>
          {METRICS.map((metric) => (
            <MetricCard key={metric.label} metric={metric} reduceMotion={reduceMotion} />
          ))}
        </div>
      </div>
    </section>
  );
}
