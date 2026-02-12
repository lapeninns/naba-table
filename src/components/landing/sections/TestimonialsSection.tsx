'use client';

import { cn } from '@/lib/utils';

import { Icon } from '../shared/Icons';
import { LOCAL_VENUES, venueNameFromLabel } from '../shared/localVenues';

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
    venue: venueNameFromLabel(LOCAL_VENUES[0]),
  },
  {
    quote:
      "We used to lose 5 tables a night to no-shows. Now? Zero. That's an extra £100k a year in my pocket.",
    venue: venueNameFromLabel(LOCAL_VENUES[3]),
  },
  {
    quote:
      'The Sunday Roast Capacity Calculator saved our kitchen. No more meltdowns, just steady revenue.',
    venue: venueNameFromLabel(LOCAL_VENUES[4]),
  },
  {
    quote:
      'We stopped juggling DMs, voicemails, and scribbled notes. Now bookings are clean, confirmed, and predictable.',
    venue: venueNameFromLabel(LOCAL_VENUES[1]),
  },
  {
    quote:
      'Our host team finally has a calm shift. Guests get clear confirmations and we get fewer last-minute surprises.',
    venue: venueNameFromLabel(LOCAL_VENUES[2]),
  },
  {
    quote:
      'We used to lose track of changes during peak service. Now everything is in one place and the floor runs smoother.',
    venue: venueNameFromLabel(LOCAL_VENUES[5]),
  },
  {
    quote:
      'Weekend trading is noticeably steadier. Less chaos, fewer gaps, and better visibility for the team.',
    venue: venueNameFromLabel(LOCAL_VENUES[6]),
  },
  {
    quote:
      'Setup was quick and the impact was immediate. We spend less time chasing bookings and more time serving guests.',
    venue: venueNameFromLabel(LOCAL_VENUES[7]),
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-24 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold mb-4">Proof it Works.</h2>
            <p className="text-slate-400 text-lg">
              Food-led pubs using Nab a Table to print money.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 lg:justify-end">
            {OBJECTION_POINTS.map((point) => (
              <div
                key={point}
                className="px-4 py-2 rounded-full border border-slate-700 bg-slate-800/50 text-sm font-medium text-slate-300 flex items-center gap-2"
              >
                <Icon name="check" className="text-green-400" /> {point}
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {TESTIMONIALS.map((testimonial, index) => {
            return (
              <div
                key={testimonial.venue}
                className={cn(
                  'p-8 rounded-2xl bg-slate-800/50 border border-slate-700 motion-safe:reveal-up hover:bg-slate-800 transition-colors',
                )}
                style={{ transitionDelay: `${index * 80}ms` }}
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
                  <div className="font-bold text-white">{testimonial.venue}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
