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
    <main className="guest-theme flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-800 via-blue-900 to-slate-950 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-2xl bg-white/5 p-6 sm:p-8 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
        <div className="mx-auto mb-5 inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-emerald-200/15 text-emerald-300 ring-1 ring-emerald-200/40">
          <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
        </div>

        <h1 className="mb-3 text-2xl sm:text-3xl font-bold tracking-tight">
          Reservation Confirmed!
        </h1>

        <p className="mb-6 sm:mb-8 text-sm sm:text-base text-slate-200 max-w-sm mx-auto">
          Your table has been reserved. We have sent a confirmation email with all the details.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/guest/bookings">
            <Button size="lg" className="w-full sm:w-auto rounded-full shadow-lg">
              View My Bookings
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto rounded-full">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

