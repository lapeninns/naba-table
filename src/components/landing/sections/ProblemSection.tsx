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
    <section id="system" className="pg-section border-b border-border/70 bg-muted/30">
      <div className="pg-container">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[4.2fr_7.8fr] lg:gap-8">
          <div className="pg-panel flex flex-col gap-4 rounded-[var(--pg-radius-xl)] border-primary/15 bg-background/90 p-5 shadow-[var(--pg-shadow-soft)] sm:p-6 md:p-7 motion-safe:reveal-up">
            <p className="pg-kicker">The &apos;No Empty Tables&apos; Blueprint</p>
            <h2 className="pg-section-title">
              Engineered specifically around the realities of a busy UK pub.
            </h2>
            <p className="pg-lead">
              Generic booking forms cost you money. Nabatable is a comprehensive service blueprint
              that solves your biggest headaches before the shift even begins.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-[var(--pg-radius-md)] border border-border/70 bg-muted/40 p-3">
                <p className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.22em] text-primary">
                  4 core systems
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Working as one operating model</p>
              </div>
              <div className="rounded-[var(--pg-radius-md)] border border-border/70 bg-muted/40 p-3">
                <p className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.22em] text-primary">
                  Built for pubs
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Not generic booking software</p>
              </div>
            </div>
          </div>
          <div className="pg-grid grid-cols-1 sm:grid-cols-2">
          {BLUEPRINT_FEATURES.map((feature, index) => (
            <Card
              key={feature.title}
              className="pg-panel group overflow-hidden border-border/70 bg-background/96 shadow-[var(--pg-shadow-xs)] motion-safe:reveal-up"
            >
              <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-border/60 bg-muted/25 p-5 sm:p-6 md:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div className="mb-1 flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition duration-200 ease-out group-hover:rotate-3 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground sm:mb-0">
                  <Icon name={feature.icon} className="size-6" />
                  </div>
                  <div className="font-[var(--pg-font-mono)] text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    0{index + 1}
                  </div>
                </div>
                <CardTitle className="pg-card-title text-left">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 md:px-7 md:pb-7">
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {feature.desc}
                </p>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
