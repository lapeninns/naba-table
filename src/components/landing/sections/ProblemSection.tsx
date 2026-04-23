'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Icon } from '../shared/Icons';

const BLUEPRINT_FEATURES = [
  {
    title: 'The "Table-Filler" Booking Engine',
    desc: 'Turn website visitors into confirmed diners instantly with live availability and targeted party-size options.',
    icon: 'chart' as const,
  },
  {
    title: 'The "Zero No-Show" Automator',
    desc: 'Automatically send tailored emails and SMS reminders so guests show up on time, every time - protecting your revenue without manual follow-ups.',
    icon: 'shield' as const,
  },
  {
    title: 'The Floor Protector',
    desc: 'Never double-book or overwhelm the kitchen again. Advanced turn-time controls and capacity limits ensure a flawless service flow.',
    icon: 'lock' as const,
  },
  {
    title: 'The Manager\'s "God-Mode" Dashboard',
    desc: 'Walk into every shift with total clarity. Get daily summaries and predictive service pressure mapped out instantly.',
    icon: 'user' as const,
  },
];

export function ProblemSection() {
  return (
    <section id="system" className="pg-section border-b border-border bg-background">
      <div className="pg-container">
        <div className="mx-auto mb-10 flex max-w-3xl flex-col gap-3 text-center sm:mb-12 sm:gap-4 md:mb-14 lg:mb-16 motion-safe:reveal-up">
          <p className="pg-kicker">The &apos;No Empty Tables&apos; Blueprint</p>
          <h2 className="pg-section-title">
            Engineered specifically around the realities of a busy UK pub.
          </h2>
          <p className="pg-lead">
            Generic booking forms cost you money. Nabatable is a comprehensive service blueprint
            that solves your biggest headaches before the shift even begins.
          </p>
        </div>
        <div className="pg-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {BLUEPRINT_FEATURES.map((feature, index) => (
            <Card
              key={feature.title}
              className="pg-card group motion-safe:reveal-up"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <CardHeader className="flex flex-col gap-2 space-y-0 p-5 sm:gap-3 sm:p-6 md:p-8">
                <div className="mb-1 flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition duration-200 ease-out group-hover:rotate-3 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground sm:mb-0">
                  <Icon name={feature.icon} className="size-6" />
                </div>
                <CardTitle className="pg-card-title text-left">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6 md:px-8 md:pb-8">
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {feature.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
