import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thank You",
  description: "Appreciation page shown after a booking flow is completed.",
};

export default function ThankYouPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24 text-center text-slate-800">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Thanks for booking with SajiloReserveX</h1>
        <p className="text-slate-600">
          Bookings powered by SajiloReserveX keep your favourite tables ready. We&apos;ve sent a confirmation email with
          everything you need to manage your visit.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Return home
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Make another booking
          </Link>
        </div>
      </div>
    </main>
  );
}
