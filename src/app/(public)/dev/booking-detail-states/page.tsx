import Link from 'next/link';

import {
  ReservationDetailErrorStatePreview,
  ReservationDetailLoadingState,
} from '@/components/features/booking/detail/ReservationDetailStates';
import { enforceDevOnly } from '@/src/app/(public)/dev/_shared/enforceDevOnly';

export const dynamic = 'force-dynamic';

export default async function DevBookingDetailStatesPage() {
  enforceDevOnly();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          Dev-only booking detail states
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Booking detail loading and error states
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This local-only harness reuses the canonical booking-detail loading and error surfaces so
          browser validators can confirm the guest never sees a blank shell when reservation data is
          still loading or fails to load.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Loading state</h2>
          <p className="text-sm text-muted-foreground">
            Matches the shared booking-detail skeleton shown before reservation data is ready.
          </p>
        </div>
        <ReservationDetailLoadingState />
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Error state</h2>
          <p className="text-sm text-muted-foreground">
            Matches the shared booking-detail fallback shown when reservation loading fails.
          </p>
        </div>
        <ReservationDetailErrorStatePreview />
      </section>

      <Link
        className="w-fit rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        href="/dev/booking-recovery?fixture=active"
      >
        Back to booking recovery harness
      </Link>
    </main>
  );
}
