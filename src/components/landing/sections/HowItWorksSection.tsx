'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const HOW_IT_WORKS_STEPS = [
  {
    title: 'We Clone Your Floor',
    description:
      'We map your tables and turn times. You do nothing. We handle the setup in < 24 hours.',
  },
  {
    title: 'We Plug The Leaks',
    description:
      'We integrate with your site. Every booking is captured, confirmed, and locked in.',
  },
  {
    title: 'You Scale Revenue',
    description:
      'Fill the empty seats. Upsell the VIPs. Cut the labor costs. Watch profit margins jump.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="pg-section border-b border-border/70 bg-background">
      <div className="pg-container">
        <div className="mb-10 text-center sm:mb-12 md:mb-14 lg:mb-16 motion-safe:reveal-up">
          <h2 className="pg-section-title">The 3-step mechanism</h2>
        </div>
        <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          <div className="pointer-events-none absolute left-6 top-6 bottom-6 hidden w-px bg-border md:hidden" />
          <div className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-6 hidden h-px bg-border md:block" />
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <Card
              key={step.title}
              className="pg-panel relative border-border/70 bg-background/96 text-center shadow-[var(--pg-shadow-xs)] motion-safe:reveal-up"
            >
              <CardHeader className="flex flex-col items-center gap-3 space-y-0 p-5 sm:p-6 md:gap-4 md:p-7">
                <div className="z-10 flex size-12 items-center justify-center rounded-full border-4 border-background bg-primary text-lg font-bold text-primary-foreground shadow-[var(--pg-shadow-button)] sm:text-xl">
                  {index + 1}
                </div>
                <CardTitle className="pg-card-title">{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6 md:px-7 md:pb-7">
                <p className="text-sm text-muted-foreground sm:text-base">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
