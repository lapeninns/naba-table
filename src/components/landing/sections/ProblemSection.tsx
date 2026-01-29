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
    <section id="problem" className="py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 motion-safe:reveal-up">
          <p className="text-xs font-bold uppercase tracking-widest text-red-800 mb-2">
            The Pain is The Pitch
          </p>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            The &quot;Old Way&quot; is Broken.
          </h2>
          <p className="text-lg text-slate-600">
            Most operators accept these problems as &quot;part of business&quot;. They aren&apos;t.
            They are leaks in your bucket.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, index) => (
            <div
              key={problem.title}
              className="group p-8 rounded-2xl bg-red-50/30 border border-red-100 transition-all duration-200 ease-out hover:bg-red-50 group-hover:-translate-y-2 group-hover:shadow-xl motion-safe:reveal-up"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6 transition-all duration-200 ease-out group-hover:bg-red-200 group-hover:text-red-700 group-hover:rotate-6 group-hover:scale-110">
                <Icon name={problem.icon} className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{problem.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{problem.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
