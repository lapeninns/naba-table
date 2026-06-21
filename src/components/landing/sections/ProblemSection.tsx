'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Icon } from '../shared/Icons';

const SERVICE_LEAKS = [
  'Guests book, then drift because nobody has time to chase every confirmation.',
  'Tables get filled in the wrong order and the kitchen pressure builds quietly.',
  'Managers start the shift without one clean view of demand, risk, and capacity.',
] as const;

const BLUEPRINT_FEATURES = [
  {
    title: 'Booking capture',
    desc: 'Turn website visitors into confirmed diners with live availability and party-size rules that match how your pub really trades.',
    icon: 'chart' as const,
  },
  {
    title: 'No-show prompts',
    desc: 'Send the right SMS and email prompts automatically, so the team is not chasing guests while service is already moving.',
    icon: 'shield' as const,
  },
  {
    title: 'Floor protection',
    desc: 'Control turn times, table joins, and service pressure before the doors open, instead of fixing collisions at the host stand.',
    icon: 'lock' as const,
  },
  {
    title: 'Manager visibility',
    desc: 'Walk into the shift with one board for bookings, pressure points, reminders, and the actions that still need human judgement.',
    icon: 'user' as const,
  },
];

export function ProblemSection() {
  return (
    <section id="system" className="pg-section border-b border-border/70 bg-muted/30">
      <div className="pg-container">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[5fr_7fr] lg:gap-8">
          <div className="pg-panel flex flex-col gap-5 rounded-[var(--pg-radius-xl)] border-primary/15 bg-background/90 p-5 sm:p-6 md:p-7 motion-safe:reveal-up">
            <p className="pg-kicker">The service leak Nabatable closes</p>
            <h2 className="pg-section-title">Empty tables rarely start as empty tables.</h2>
            <p className="pg-lead">
              They start as missed confirmations, vague table rules, and managers forced to make
              decisions without a clean view of the night ahead.
            </p>
            <div className="grid gap-3 pt-1">
              {SERVICE_LEAKS.map((leak, index) => (
                <div
                  key={leak}
                  className="flex gap-3 rounded-[var(--pg-radius-md)] border border-border/70 bg-muted/35 p-3"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-[var(--pg-font-mono)] text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-muted-foreground">{leak}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[var(--pg-radius-md)] border border-primary/20 bg-primary/[0.06] p-4">
              <p className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.18em] text-primary">
                Nabatable installs the operating model before those leaks cost covers.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BLUEPRINT_FEATURES.map((feature, index) => (
              <Card
                key={feature.title}
                className="pg-card group overflow-hidden border-border/70 bg-background/96 motion-safe:reveal-up"
              >
                <CardHeader className="flex flex-col gap-3 space-y-0 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] bg-primary/10 text-primary transition duration-200 ease-out group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon name={feature.icon} className="size-5" />
                    </div>
                    <div className="font-[var(--pg-font-mono)] text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      0{index + 1}
                    </div>
                  </div>
                  <CardTitle className="pg-card-title text-left">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
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
