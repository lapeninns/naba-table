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
    <section id="how-it-works" className="border-b border-border bg-background py-12 sm:py-16 md:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-8 2xl:px-10">
        <div className="mb-10 text-center sm:mb-12 md:mb-14 lg:mb-16 motion-safe:reveal-up">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">
            The 3-step mechanism
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3 md:gap-6 lg:gap-8 xl:gap-10">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <Card
              key={step.title}
              className="relative text-center shadow-sm motion-safe:reveal-up"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <CardHeader className="flex flex-col items-center gap-3 space-y-0 p-5 sm:p-6 md:gap-4">
                <div className="z-10 flex size-12 items-center justify-center rounded-full border-4 border-background bg-primary text-lg font-bold text-primary-foreground shadow-md sm:text-xl">
                  {index + 1}
                </div>
                <CardTitle className="text-lg sm:text-xl">{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
                <p className="text-sm text-muted-foreground sm:text-base">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
