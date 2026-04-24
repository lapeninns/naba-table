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
    <section id="metrics" className="pg-section border-b border-border/70 bg-background">
      <div className="pg-container">
        <div className="grid grid-cols-1 gap-4 rounded-[var(--pg-radius-xl)] border border-primary/15 bg-[linear-gradient(180deg,hsl(var(--muted)/0.72),hsl(var(--background)))] p-4 shadow-[var(--pg-shadow-soft)] sm:gap-5 sm:p-6 lg:grid-cols-[5fr_3.5fr_3.5fr] lg:p-7">
          <div className="flex flex-col justify-center gap-3 rounded-[var(--pg-radius-lg)] bg-background/85 p-4 sm:gap-4 sm:p-5">
            <h2 className="pg-section-title">Numbers don&apos;t lie.</h2>
            <p className="pg-lead">
              Stop guessing. See exactly how automated confirmations and waitlist monetization
              impact your bottom line.
            </p>
            <p className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.22em] text-primary">
              Revenue proof, not dashboard theatre
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
