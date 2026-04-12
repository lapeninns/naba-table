'use client';

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
    <section id="problem" className="border-b border-border bg-background py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 motion-safe:reveal-up">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
            The Pain is The Pitch
          </p>
          <h2 className="mb-4 text-3xl font-bold text-foreground">
            The &quot;Old Way&quot; is Broken.
          </h2>
          <p className="text-lg text-muted-foreground">
            Most operators accept these problems as &quot;part of business&quot;. They aren&apos;t.
            They are leaks in your bucket.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, index) => (
            <div
              key={problem.title}
              className="group rounded-[1.75rem] border border-border bg-card/90 p-8 transition-all duration-200 ease-out hover:-translate-y-2 hover:border-primary/20 hover:bg-card group-hover:shadow-xl motion-safe:reveal-up"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-200 ease-out group-hover:rotate-6 group-hover:scale-110 group-hover:bg-primary/15">
                <Icon name={problem.icon} className="w-6 h-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-foreground">{problem.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{problem.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
