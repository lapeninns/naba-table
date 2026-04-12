import { CheckCircle2, Sparkles } from 'lucide-react';

import { BookingStatePage } from '@/components/features/booking/ui/BookingStatePage';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reservation Confirmed · Nab a Table',
  description: 'Your table has been reserved.',
};

export default function ReservationThankYouPage() {
  return (
    <BookingStatePage
      eyebrow="Reservation confirmed"
      title="Your table is in place and the follow-up details are already on their way."
      description="Check your inbox for the booking email and keep going to your reservations if you want the fastest route back into this plan."
      icon={CheckCircle2}
      tone="success"
      primaryAction={{ href: '/guest/bookings', label: 'Open my bookings' }}
      secondaryAction={{ href: '/restaurants', label: 'Explore more venues', variant: 'secondary' }}
      aside={
        <>
          <div className="space-y-2">
            <p className="luminous-kicker">Confirmation flow</p>
            <p className="text-sm font-semibold text-foreground">The canonical journey stays live.</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Booking details, changes, and receipt actions all continue from the same guest
              management surfaces.
            </p>
          </div>
          <div className="luminous-card-soft rounded-[var(--luminous-radius)] px-4 py-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Keep the link</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  The email link still takes you straight back to the booking when you need it.
                </p>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
}
