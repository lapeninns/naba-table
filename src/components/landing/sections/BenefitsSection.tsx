'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { Icon } from '../shared/Icons';

const BENEFITS = [
  {
    title: 'The Core Engine',
    description:
      'Automated bookings and email confirmations. No-shows drop to near zero immediately.',
    value: '£5,000 Value',
    icon: 'check' as const,
  },
  {
    title: 'Sunday Roast Capacity Calc',
    description:
      'An algorithm that stops kitchen meltdowns by pacing covers perfectly during peak service.',
    value: '£1,500 Value',
    icon: 'clock' as const,
  },
  {
    title: 'No-Show Prevention Pack',
    description:
      'Email reminder sequences and confirmation copy designed specifically for UK pubs.',
    value: '£1,000 Value',
    icon: 'shield' as const,
  },
  {
    title: 'Host Stand Playbook',
    description:
      '10-minute pre-shift checklist and scripts so staff stop "playing Tetris" with your floor.',
    value: '£2,000 Value',
    icon: 'user' as const,
  },
  {
    title: 'Whale-Watcher CRM',
    description:
      'Identify high-spenders instantly. Ensure VIPs get the treatment that drives 3x loyalty.',
    value: '£2,000 Value',
    icon: 'chart' as const,
  },
  {
    title: 'White Glove Migration',
    description:
      'We handle the entire tech switch from old systems or spreadsheets. You do zero work.',
    value: 'PRICELESS',
    icon: 'zap' as const,
  },
];

export function BenefitsSection() {
  return (
    <section id="features" className="pg-section border-b border-border bg-background">
      <div className="pg-container">
        <div className="mx-auto mb-10 flex max-w-3xl flex-col items-center gap-3 text-center sm:mb-12 sm:gap-4 md:mb-14 lg:mb-16 motion-safe:reveal-up">
          <Badge variant="secondary" className="pg-chip">
            The UK pub profit stack
          </Badge>
          <h2 className="pg-section-title">The total lockdown bundle</h2>
          <p className="pg-lead">Total value: £12,500+ / yours for less than a missed 4-top.</p>
        </div>

        <div className="pg-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit, index) => {
            const isFeatured = index === BENEFITS.length - 1;
            return (
              <Card
                key={benefit.title}
                className={cn(
                  'pg-card group motion-safe:reveal-up',
                  isFeatured
                    ? 'pg-panel border-primary/20 sm:col-span-2 lg:col-span-3'
                    : 'hover:border-border/80',
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-4 sm:p-5 md:p-6">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm transition duration-200 ease-out group-hover:rotate-3 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon name={benefit.icon} className="size-6" />
                  </div>
                  <Badge variant={isFeatured ? 'metric' : 'secondary'} className="shrink-0">
                    {benefit.value}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-4 pb-4 pt-0 sm:px-5 sm:pb-5 md:px-6 md:pb-6">
                  <CardTitle className="heading-subsection text-left">{benefit.title}</CardTitle>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
