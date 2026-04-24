'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
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
    <section
      id="testimonials"
      className="pg-section border-b border-border/70 bg-muted/30 text-foreground"
    >
      <div className="pg-container">
        <div className="mb-10 flex flex-col gap-8 rounded-[var(--pg-radius-xl)] border border-primary/15 bg-background/92 p-5 shadow-[var(--pg-shadow-soft)] sm:mb-12 sm:p-6 md:mb-14 lg:grid lg:grid-cols-[5fr_7fr] lg:items-end lg:gap-10 xl:gap-12">
          <div className="flex flex-col gap-3 sm:gap-4">
            <h2 className="pg-section-title">Proof it works.</h2>
            <p className="pg-lead">Food-led pubs using Nab a Table to print money.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 lg:justify-end">
            {OBJECTION_POINTS.map((point) => (
              <Badge
                key={point}
                variant="guest-chip-outline"
                className="pg-chip border-border bg-muted px-3 py-1.5 text-xs font-medium sm:text-sm"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="check" className="text-primary" />
                  {point}
                </span>
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:gap-6 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4 xl:gap-8">
          {TESTIMONIALS.map((testimonial, index) => {
            return (
              <Card
                key={testimonial.venue}
                className={cn(
                  'overflow-hidden border-border/70 bg-background/96 text-foreground shadow-[var(--pg-shadow-xs)] motion-safe:reveal-up',
                  index % 3 === 0 ? 'pg-panel border-primary/15' : 'pg-card',
                )}
              >
                <CardContent className="flex flex-col gap-4 p-5 sm:gap-5 sm:p-6 md:gap-6 md:p-7 lg:p-8">
                  <div className="flex text-primary">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Icon
                        key={star}
                        name="star"
                        className="me-1 inline-block size-4 fill-current sm:me-1.5"
                      />
                    ))}
                  </div>
                  <blockquote className="text-base italic leading-relaxed text-muted-foreground sm:text-lg">
                    &quot;{testimonial.quote}&quot;
                  </blockquote>
                </CardContent>
                <CardFooter className="border-t border-border/70 bg-muted/20 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 md:px-7 md:pb-7 lg:px-8 lg:pb-8">
                  <p className="text-sm font-bold text-foreground sm:text-base">
                    {testimonial.venue}
                  </p>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
