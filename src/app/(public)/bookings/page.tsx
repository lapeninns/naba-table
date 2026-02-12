import { CalendarCheck, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bookings · Nab a Table',
  description: 'Browse restaurants to book a table, or sign in to manage your bookings.',
};

export default function BookingsLandingPage() {
  return (
    <div className="min-h-screen bg-surface-warm pb-20">
      {/* Hero Section */}
      <section className="border-b border-slate-100 bg-gradient-hero">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 sm:gap-6 sm:px-6 sm:py-16 lg:py-20">
          <div className="animate-fade-in-up space-y-2 sm:space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bookings</p>
            <h1 className="heading-hero">Your Reservations</h1>
            <p className="text-body-warm max-w-2xl">
              Book a new table or manage existing reservations.
            </p>
          </div>
        </div>
      </section>

      {/* Cards */}
      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section
          className="stagger-container grid gap-6 sm:grid-cols-2"
          aria-label="Booking actions"
        >
          {/* Book a table */}
          <div className="animate-fade-in-up rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <h2 className="heading-subsection">Book a table</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Find a restaurant, pick a date and time, and confirm your reservation.
            </p>
            <div className="mt-6">
              <Button
                asChild
                size="lg"
                className="min-h-[44px] w-full rounded-full btn-tactile focus-ring touch-feedback sm:w-auto"
              >
                <Link href="/restaurants">Browse restaurants</Link>
              </Button>
            </div>
          </div>

          {/* Manage bookings */}
          <div className="animate-fade-in-up rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <h2 className="heading-subsection">Manage bookings</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to see your upcoming and past bookings, or make changes where available.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="min-h-[44px] w-full rounded-full btn-tactile focus-ring touch-feedback sm:w-auto"
              >
                <Link href="/guest/bookings">View my bookings</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-[44px] w-full rounded-full btn-tactile focus-ring touch-feedback sm:w-auto"
              >
                <Link href="/auth/signin?redirectedFrom=/bookings">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
