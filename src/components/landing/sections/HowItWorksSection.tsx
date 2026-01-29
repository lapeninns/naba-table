'use client';

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
    <section id="how-it-works" className="py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 motion-safe:reveal-up">
          <h2 className="text-3xl font-bold text-slate-900">The 3-Step Mechanism</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10 hidden md:block" />
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div
              key={step.title}
              className="relative bg-white p-6 rounded-xl border border-slate-100 shadow-sm text-center motion-safe:reveal-up"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4 relative z-10 border-4 border-white shadow-md text-xl">
                {index + 1}
              </div>
              <h3 className="font-bold text-slate-900 mb-2 text-xl">{step.title}</h3>
              <p className="text-sm text-slate-700">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
