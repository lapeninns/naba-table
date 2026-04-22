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
    <section id="features" className="border-b border-border bg-background py-12 sm:py-16 md:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-8 2xl:px-10">
        <div className="mx-auto mb-10 flex max-w-3xl flex-col items-center gap-3 text-center sm:mb-12 sm:gap-4 md:mb-14 lg:mb-16 motion-safe:reveal-up">
          <Badge variant="secondary">The UK pub profit stack</Badge>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">
            The total lockdown bundle
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            Total value: £12,500+ / yours for less than a missed 4-top.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:gap-6 lg:grid-cols-3 lg:gap-8">
          {BENEFITS.map((benefit, index) => {
            const isFeatured = index === BENEFITS.length - 1;
            return (
              <Card
                key={benefit.title}
                className={cn(
                  'group transition-all duration-200 ease-out motion-safe:reveal-up hover:-translate-y-1 hover:shadow-lg',
                  isFeatured
                    ? 'border-primary/20 bg-gradient-to-br from-muted/80 to-primary/5 sm:col-span-2 lg:col-span-3'
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
                  <CardTitle className="text-left text-lg sm:text-xl">{benefit.title}</CardTitle>
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
