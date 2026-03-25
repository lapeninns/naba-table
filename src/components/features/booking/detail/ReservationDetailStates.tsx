'use client';

import Link from 'next/link';

import { GuestError } from '@/components/guest/ui';
import { Skeleton } from '@/components/ui/skeleton';

export function ReservationDetailLoadingState() {
  return (
    <section className="min-h-screen bg-surface-warm py-8 pb-20 sm:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 sm:px-6 sm:space-y-8">
        <div className="animate-fade-in-up space-y-6 rounded-2xl border border-border bg-background p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-5 max-w-full w-96" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </section>
  );
}

export function ReservationDetailErrorState({
  description = 'We encountered an error loading your reservation.',
  onRetry,
  redirectHref = '/guest/dashboard',
}: {
  description?: string;
  onRetry?: () => void;
  redirectHref?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-surface-warm">
      <GuestError
        description={description}
        onRetry={onRetry}
        redirectHref={redirectHref}
        redirectLabel="Return to dashboard"
      />
    </div>
  );
}

export function ReservationDetailErrorStatePreview() {
  return (
    <div className="space-y-4">
      <ReservationDetailErrorState description="Unable to load reservation" onRetry={() => undefined} />
      <div className="rounded-2xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
        <p>
          The retry button keeps the shared booking-detail fallback visible while the guest can
          return to a safe destination.
        </p>
        <Link className="font-semibold text-primary underline" href="/guest/dashboard">
          Preview fallback destination
        </Link>
      </div>
    </div>
  );
}
