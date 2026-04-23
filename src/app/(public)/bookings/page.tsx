import { CalendarCheck, UtensilsCrossed } from 'lucide-react';

import {
  GuestActionCard,
  GuestHero,
  GuestPageFrame,
  GuestPrimaryButton,
  GuestSecondaryButton,
  GuestSectionHeader,
} from '@/components/guest/ui';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bookings · Nab a Table',
  description: 'Browse restaurants to book a table, or sign in to manage your bookings.',
};

export default function BookingsLandingPage() {
  return (
    <GuestPageFrame>
      <GuestHero
        eyebrow="Bookings"
        title="Reserve, recover, or review your table."
        description="Start a new booking or pick up an existing reservation without hunting through emails."
        compact
      />

      <section className="pg-section-tight" aria-label="Booking actions">
        <div className="pg-container space-y-6">
          <GuestSectionHeader
            eyebrow="Choose the next step"
            title="One place for guest reservations"
            description="The fastest route depends on whether you are planning a new visit or managing one already confirmed."
          />
          <div className="pg-stagger grid gap-4 sm:grid-cols-2 sm:gap-6">
            <div className="pg-appear">
              <GuestActionCard
                icon={UtensilsCrossed}
                title="Book a table"
                description="Browse live venues, choose a date and time, and confirm your reservation."
                href="/restaurants"
                actionLabel="Browse restaurants"
              />
            </div>
            <div className="pg-appear">
              <GuestActionCard
                icon={CalendarCheck}
                title="Manage bookings"
                description="See upcoming and past reservations, then make changes where the restaurant allows it."
                actions={
                  <>
                    <GuestPrimaryButton href="/guest/bookings">View my bookings</GuestPrimaryButton>
                    <GuestSecondaryButton href="/auth/signin?redirectedFrom=/bookings">
                      Sign in
                    </GuestSecondaryButton>
                  </>
                }
              />
            </div>
          </div>
        </div>
      </section>
    </GuestPageFrame>
  );
}
