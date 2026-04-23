import { CalendarCheck, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Bookings · Nab a Table',
  description: 'Browse restaurants to book a table, or sign in to manage your bookings.',
};

const primaryActionClass =
  'min-h-[44px] w-full rounded-full btn-tactile focus-ring touch-feedback sm:min-h-[48px] sm:w-auto';

const secondaryActionClass =
  'min-h-[44px] w-full rounded-full btn-tactile focus-ring touch-feedback sm:min-h-[48px] sm:w-auto';

function BookingHubActionCard({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <Card className="h-full rounded-3xl border border-border/60 bg-background/95 p-6 shadow-sm sm:p-8">
      <div className="flex h-full flex-col gap-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>

        <div className="space-y-2">
          <h2 className="heading-subsection">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          {actions}
        </div>
      </div>
    </Card>
  );
}

export default function BookingsLandingPage() {
  return (
    <div className="min-h-[100dvh] bg-surface-warm pb-16 sm:pb-20">
      {/* Hero Section */}
      <section className="border-b border-border/50 bg-gradient-hero">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:gap-8 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
          <div className="animate-fade-in-up space-y-3 sm:space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-subtle">Bookings</p>
            <h1 className="heading-hero">Your Reservations</h1>
            <p className="text-body-warm max-w-2xl">
              Book a new table or manage existing reservations.
            </p>
          </div>
        </div>
      </section>

      {/* Cards */}
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12 lg:px-10">
        <section
          className="stagger-container grid gap-4 sm:grid-cols-2 sm:gap-6"
          aria-label="Booking actions"
        >
          <div className="animate-fade-in-up">
            <BookingHubActionCard
              icon={UtensilsCrossed}
              title="Book a table"
              description="Find a restaurant, pick a date and time, and confirm your reservation."
              actions={
                <Button asChild size="lg" className={primaryActionClass}>
                  <Link href="/restaurants">Browse restaurants</Link>
                </Button>
              }
            />
          </div>

          <div className="animate-fade-in-up">
            <BookingHubActionCard
              icon={CalendarCheck}
              title="Manage bookings"
              description="Sign in to see your upcoming and past bookings, or make changes where available."
              actions={
                <>
                  <Button asChild size="lg" className={primaryActionClass}>
                    <Link href="/guest/bookings">View my bookings</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className={secondaryActionClass}>
                    <Link href="/auth/signin?redirectedFrom=/bookings">Sign in</Link>
                  </Button>
                </>
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
