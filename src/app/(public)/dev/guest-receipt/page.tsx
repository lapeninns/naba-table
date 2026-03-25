import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import Link from 'next/link';

import { ReceiptClient } from '@/app/guest/bookings/[bookingId]/receipt/ReceiptClient';
import {
  getBookingLifecycleFixture,
  getDefaultBookingLifecycleFixture,
  type BookingLifecycleFixtureKey,
} from '@/src/app/(public)/dev/_mocks/bookingLifecycleFixtures';
import { enforceDevOnly } from '@/src/app/(public)/dev/_shared/enforceDevOnly';
import { reservationKeys } from '@shared/api/queryKeys';

type SearchParams = Promise<{
  fixture?: string;
}>;

export const dynamic = 'force-dynamic';

const FIXTURE_OPTIONS: BookingLifecycleFixtureKey[] = ['active', 'pending', 'cancelled'];

export default async function DevGuestReceiptPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  enforceDevOnly();

  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedFixture = resolvedSearchParams.fixture ?? null;
  const selectedFixture =
    getBookingLifecycleFixture(requestedFixture) ?? getDefaultBookingLifecycleFixture();
  const queryClient = new QueryClient();

  queryClient.setQueryData(
    reservationKeys.detail(selectedFixture.reservation.id),
    selectedFixture.reservation,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          Dev-only guest receipt
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Guest receipt fixture preview
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This local-only harness hydrates the canonical guest receipt UI with deterministic booking
          fixtures when local runtime data does not include tokenized receipt records.
        </p>
      </header>

      <nav aria-label="Receipt fixture options" className="flex flex-wrap gap-3">
        {FIXTURE_OPTIONS.map((option) => {
          const isActive = option === requestedFixture || (!requestedFixture && option === 'active');

          return (
            <Link
              key={option}
              className={
                isActive
                  ? 'rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                  : 'rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent'
              }
              href={`/dev/guest-receipt?fixture=${option}`}
            >
              {option === 'active'
                ? 'Confirmed fixture'
                : option === 'pending'
                  ? 'Pending fixture'
                  : 'Cancelled fixture'}
            </Link>
          );
        })}
      </nav>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ReceiptClient
          reservationId={selectedFixture.reservation.id}
          hasSession={false}
          prefetchedStatus={selectedFixture.reservation.status}
          initialReservation={selectedFixture.reservation}
        />
      </HydrationBoundary>
    </main>
  );
}
