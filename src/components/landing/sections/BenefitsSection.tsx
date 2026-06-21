'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { Icon } from '../shared/Icons';

const BENEFITS = [
  {
    title: 'Your pub stays bookable after the phone stops being answered.',
    description:
      'Guests can choose the right party size and time while your rules protect capacity.',
    value: 'Capture',
    icon: 'check' as const,
  },
  {
    title: 'Every booking gets a confirmation rhythm.',
    description: 'SMS and email prompts reduce the manual chasing that steals time before service.',
    value: 'Remind',
    icon: 'clock' as const,
  },
  {
    title: 'The floor plan follows your actual trading rules.',
    description: 'Turn times, service periods, and table joins are configured around your venue.',
    value: 'Control',
    icon: 'shield' as const,
  },
  {
    title: 'Managers see pressure before it becomes a problem.',
    description: 'Daily summaries and service views surface the risks worth acting on.',
    value: 'Visibility',
    icon: 'user' as const,
  },
  {
    title: 'The waitlist becomes useful, not decorative.',
    description: 'Last-minute gaps can be filled from guests who already want the table.',
    value: 'Recover',
    icon: 'chart' as const,
  },
  {
    title: 'White-Glove setup means your team does not inherit a configuration project.',
    description:
      'We configure the booking rules, table logic, messages, and manager views around the way your pub runs.',
    value: 'Installed',
    icon: 'zap' as const,
  },
];

export function BenefitsSection() {
  return (
    <section id="value-stack" className="pg-section border-b border-border/70 bg-muted/30">
      <div className="pg-container">
        <div className="pg-panel mb-6 flex flex-col items-start gap-4 rounded-[var(--pg-radius-xl)] border-primary/15 bg-background/92 p-5 text-left sm:mb-8 sm:p-6 md:p-7 motion-safe:reveal-up">
          <Badge variant="guest-chip" className="pg-chip">
            What changes operationally
          </Badge>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_5fr] lg:gap-8">
            <div>
              <h2 className="pg-section-title">
                Nabatable is the layer between online demand and a calm service.
              </h2>
              <p className="pg-lead mt-3">
                The value is not another booking form. It is the operating discipline around the
                booking.
              </p>
            </div>
            <div className="flex flex-wrap content-start gap-2 pt-1 lg:justify-end">
              {['No lock-in contracts', 'Transparent service logs', 'White-Glove setup'].map(
                (item) => (
                  <Badge key={item} variant="guest-chip-outline" className="pg-chip bg-muted">
                    {item}
                  </Badge>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {BENEFITS.map((benefit, index) => {
            const isFeatured = index === BENEFITS.length - 1;
            return (
              <Card
                key={benefit.title}
                className={cn(
                  'group overflow-hidden border-border/70 bg-background/96 motion-safe:reveal-up',
                  isFeatured
                    ? 'pg-panel border-primary/20 bg-primary/[0.04] sm:col-span-2 lg:col-span-6'
                    : index < 2
                      ? 'pg-card lg:col-span-3'
                      : 'pg-card lg:col-span-2',
                )}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border/60 bg-muted/25 p-4 sm:p-5 md:p-6">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] border border-primary/15 bg-primary/10 text-primary transition duration-200 ease-out group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon name={benefit.icon} className="size-6" />
                  </div>
                  <Badge variant={isFeatured ? 'metric' : 'secondary'} className="shrink-0">
                    {benefit.value}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6">
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
