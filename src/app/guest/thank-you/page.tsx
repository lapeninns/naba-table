import { CheckCircle2, Clock3 } from "lucide-react";
import Link from "next/link";

import { Button } from "@shared/ui/button";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thank you · Nab a Table",
  description: "We’ve received your booking details and will keep you updated.",
};

export default function GuestThankYouPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-8 sm:px-10">
          <div className="inline-flex items-center gap-3 self-start rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Booking received
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              Thanks for booking with Nab a Table
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Your reservation details have been saved. If we need a moment to finalize the table,
              we&apos;ll email you as soon as it&apos;s confirmed. You can review or update it anytime
              from your bookings dashboard.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link href="/guest/bookings" className="sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                Manage my bookings
              </Button>
            </Link>
            <Link href="/" className="sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Return home
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-dashed border-border/80 bg-card/70 p-6 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Confirmed bookings</p>
            <p className="text-sm text-muted-foreground">
              Your reservation is set. You&apos;ll find the details and any updates in{" "}
              <Link href="/guest/bookings" className="font-medium text-emerald-700 underline underline-offset-4">
                Manage bookings
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock3 className="mt-1 h-5 w-5 text-blue-600" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Pending requests</p>
            <p className="text-sm text-muted-foreground">
              If the booking is pending, we&apos;ll email you the moment it locks in. Refresh the
              bookings page to check status anytime.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
