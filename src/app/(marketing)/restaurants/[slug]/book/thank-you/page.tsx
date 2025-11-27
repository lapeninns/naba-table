import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@shared/ui/button';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reservation Confirmed · Nab a Table',
  description: 'Your table has been reserved.',
};

export default function ReservationThankYouPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle className="h-10 w-10" aria-hidden="true" />
        </div>

        <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">
          Reservation Confirmed!
        </h1>

        <p className="mb-8 text-base text-muted-foreground">
          Your table has been reserved. We have sent a confirmation email with all the details.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/guest/bookings">
            <Button size="lg" className="w-full sm:w-auto">
              View My Bookings
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
