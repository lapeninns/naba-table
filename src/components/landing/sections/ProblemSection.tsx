'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Icon } from '../shared/Icons';

const problems = [
  {
    title: 'The £150 Friday Night Leak',
    desc: "A single no-show on a Friday night isn't just annoying; it is £150+ burned that you can never get back.",
    icon: 'close' as const,
  },
  {
    title: 'The £45,000 Labour Trap',
    desc: 'Paying a host to manually manage DMs and phone calls is most expensive administrative work you do.',
    icon: 'user' as const,
  },
  {
    title: 'The Sunday Roast Chaos',
    desc: 'Holes appear in your book, kitchen gets slammed, and staff quit because service is unmanaged firefighting.',
    icon: 'lock' as const,
  },
];

export function ProblemSection() {
  return (
    <section id="problem" className="pg-section border-b border-border bg-background">
      <div className="pg-container">
        <div className="mx-auto mb-10 flex max-w-3xl flex-col gap-3 text-center sm:mb-12 sm:gap-4 md:mb-14 lg:mb-16 motion-safe:reveal-up">
          <p className="pg-kicker">The pain is the pitch</p>
          <h2 className="pg-section-title">The &quot;old way&quot; is broken.</h2>
          <p className="pg-lead">
            Most operators accept these problems as &quot;part of business&quot;. They aren&apos;t.
            They are leaks in your bucket.
          </p>
        </div>
        <div className="pg-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem, index) => (
            <Card
              key={problem.title}
              className="pg-card group border-destructive/20 bg-destructive/5 motion-safe:reveal-up"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <CardHeader className="flex flex-col gap-2 space-y-0 p-5 sm:gap-3 sm:p-6 md:p-8">
                <div className="mb-1 flex size-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition duration-200 ease-out group-hover:rotate-3 group-hover:scale-105 group-hover:bg-destructive/15 sm:mb-0">
                  <Icon name={problem.icon} className="size-6" />
                </div>
                <CardTitle className="heading-subsection text-left">{problem.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6 md:px-8 md:pb-8">
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {problem.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
