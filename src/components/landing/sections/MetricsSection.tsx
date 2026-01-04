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
    <section id="metrics" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-3xl font-bold text-slate-900">Numbers Don&apos;t Lie.</h2>
            <p className="text-slate-600">
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
