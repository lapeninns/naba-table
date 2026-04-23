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
    <section id="metrics" className="pg-section border-b border-border bg-muted/40">
      <div className="pg-container">
        <div className="pg-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[5fr_3.5fr_3.5fr]">
          <div className="flex flex-col gap-3 sm:gap-4 md:max-w-md lg:max-w-none lg:justify-center">
            <h2 className="pg-section-title">Numbers don&apos;t lie.</h2>
            <p className="pg-lead">
              Stop guessing. See exactly how automated confirmations and waitlist monetization
              impact your bottom line.
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
