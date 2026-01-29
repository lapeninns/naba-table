'use client';

import { cn } from '@/lib/utils';

import { Icon } from '../shared/Icons';

const OBJECTION_POINTS = [
  'Zero Setup Fee',
  'Cancel Anytime',
  '100% Satisfaction',
  'We Import Your Data',
];

const TESTIMONIALS = [
  {
    quote:
      'I was paying a host £45k/year just to answer phones. Nab a Table does it better for pennies. It paid for itself on day one.',
    name: 'Sarah J.',
    city: 'Owner, The Barley Mow',
  },
  {
    quote:
      'We used to lose 5 tables a night to no-shows. Now? Zero. That&apos;s an extra £100k a year in my pocket.',
    name: 'Marcus H.',
    city: 'GM, Riverstone Kitchen',
  },
  {
    quote:
      'The Sunday Roast Capacity Calculator saved our kitchen. No more meltdowns, just steady revenue.',
    name: 'Chef David L.',
    city: 'Harbor & Hearth',
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-24 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold mb-4">Proof it Works.</h2>
            <p className="text-slate-200 text-lg">
              Food-led pubs using Nab a Table to print money.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 lg:justify-end">
            {OBJECTION_POINTS.map((point) => (
              <div
                key={point}
                className="px-4 py-2 rounded-full border border-slate-700 bg-slate-800/50 text-sm font-medium text-slate-100 flex items-center gap-2"
              >
                <Icon name="check" className="text-green-400" /> {point}
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((testimonial, index) => {
            const delayClass = index === 0 ? 'delay-100' : index === 1 ? 'delay-200' : 'delay-300';
            return (
              <div
                key={testimonial.name}
                className={cn(
                  'p-8 rounded-2xl bg-slate-800/50 border border-slate-700 motion-safe:reveal-up hover:bg-slate-800 transition-colors',
                  delayClass,
                )}
              >
                <div className="mb-6 text-blue-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Icon
                      key={star}
                      name="star"
                      className="w-4 h-4 inline-block mr-1 fill-current"
                    />
                  ))}
                </div>
                <p className="text-lg text-slate-200 italic mb-6 leading-relaxed">
                  &quot;{testimonial.quote}&quot;
                </p>
                <div>
                  <div className="font-bold text-white">{testimonial.name}</div>
                  <div className="text-sm text-slate-200">{testimonial.city}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
