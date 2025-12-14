import Link from 'next/link';

import { Button } from '@/components/ui/button';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bookings · Nab a Table',
  description: 'Browse restaurants to book a table, or sign in to manage your bookings.',
};

export default function BookingsLandingPage() {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Bookings</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          To reserve a table, browse restaurants. If you already have a reservation, sign in to view and manage your
          bookings.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Booking actions">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Book a table</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Find a restaurant, pick a date and time, and confirm your reservation.
          </p>
          <div className="mt-4">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/restaurants">Browse restaurants</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Manage bookings</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to see your upcoming and past bookings, or make changes where available.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/guest/bookings">View my bookings</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/auth/signin?redirectedFrom=/bookings">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

