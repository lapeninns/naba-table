'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { Icon } from '../shared/Icons';

const BENEFITS = [
  {
    title: '"Always Open" Reservation Hub',
    description: 'Capture bookings 24/7 with customized seating preferences and live availability.',
    value: '24/7 Capture',
    icon: 'check' as const,
  },
  {
    title: 'Iron-Clad Reminders',
    description: 'Automated SMS and email sequences that slash no-shows.',
    value: 'No-Show Shield',
    icon: 'clock' as const,
  },
  {
    title: 'Smart-Capacity Engine',
    description: 'Total control over service periods and table turn-times.',
    value: 'Flow Control',
    icon: 'shield' as const,
  },
  {
    title: 'Conflict-Free Visual Floorplan',
    description: 'Drag, drop, and resolve seating conflicts before the doors open.',
    value: 'Clear Floor',
    icon: 'user' as const,
  },
  {
    title: 'VIP & Waitlist Maximiser',
    description:
      'Automatically fill last-minute cancellations and recognize your highest-spending regulars.',
    value: 'More Covers',
    icon: 'chart' as const,
  },
  {
    title: '"Done-For-You" White-Glove Setup (BONUS)',
    description:
      "We configure your entire system tailored perfectly to how your pub runs, so you don't have to lift a finger.",
    value: 'Included',
    icon: 'zap' as const,
  },
];

export function BenefitsSection() {
  return (
    <section id="value-stack" className="pg-section border-b border-border bg-background">
      <div className="pg-container">
        <div className="mx-auto mb-10 flex max-w-3xl flex-col items-center gap-3 text-center sm:mb-12 sm:gap-4 md:mb-14 lg:mb-16 motion-safe:reveal-up">
          <Badge variant="secondary" className="pg-chip">
            The Profit Stack
          </Badge>
          <h2 className="pg-section-title">
            Everything you need for record-breaking, stress-free shifts.
          </h2>
          <p className="pg-lead">
            We don&apos;t just give you software; we install a complete revenue-protection system.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {['No lock-in contracts', 'Full transparent logging', '100% White-Glove Setup'].map(
              (item) => (
                <Badge key={item} variant="outline" className="pg-chip bg-muted">
                  {item}
                </Badge>
              ),
            )}
          </div>
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
                  <div className="pg-card flex size-12 shrink-0 items-center justify-center rounded-xl text-primary transition duration-200 ease-out group-hover:rotate-3 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon name={benefit.icon} className="size-6" />
                  </div>
                  <Badge variant={isFeatured ? 'metric' : 'secondary'} className="shrink-0">
                    {benefit.value}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-4 pb-4 pt-0 sm:px-5 sm:pb-5 md:px-6 md:pb-6">
                  <CardTitle className="pg-card-title text-left">{benefit.title}</CardTitle>
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
