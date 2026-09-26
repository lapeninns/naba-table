import { KeyRound, Mail, ShieldCheck } from 'lucide-react';

import {
  FindBookingForm,
  type FindBookingVenue,
} from '@/components/features/booking/find/FindBookingForm';
import {
  GuestContent,
  GuestHero,
  GuestPageFrame,
  GuestPanel,
  GuestSecondaryButton,
} from '@/components/guest/ui/GuestPageShell';
import { getGuestAuthState } from '@/guest/services/auth-state.server';
import { firstString } from '@/lib/api/query-params';
import { logger } from '@/lib/logger';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find your booking · Nab a Table',
  description: 'Get a fresh link to view or manage your booking, sent to your booking email.',
};

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadVenues(): Promise<FindBookingVenue[]> {
  try {
    const restaurants = await listRestaurants();
    return restaurants
      .filter((restaurant) => Boolean(restaurant.slug))
      .map((restaurant) => ({ slug: restaurant.slug, name: restaurant.name }));
  } catch {
    logger.warn('bookings.find.venues_unavailable', {});
    return [];
  }
}

export default async function FindBookingPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = (await searchParams) ?? {};
  const initialVenueSlug = firstString(resolved, 'restaurant')?.trim().toLowerCase() ?? null;
  const [venues, { isAuthenticated }] = await Promise.all([loadVenues(), getGuestAuthState()]);

  return (
    <GuestPageFrame>
      <GuestHero
        compact
        eyebrow="Find your booking"
        title="Email me a link to my booking"
        description="Enter the email you booked with. If it matches an upcoming booking at that venue, we'll email you a link to view or manage it."
        actions={
          isAuthenticated ? (
            <GuestSecondaryButton href="/guest/bookings">My bookings</GuestSecondaryButton>
          ) : null
        }
        meta={
          <>
            <span className="pg-chip">
              <Mail className="size-3.5" aria-hidden />
              Sent to your booking email
            </span>
            <span className="pg-chip">
              <ShieldCheck className="size-3.5" aria-hidden />
              Booking protected
            </span>
          </>
        }
        aside={
          <GuestPanel className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <KeyRound className="size-5" aria-hidden />
              </span>
              <div>
                <p className="pg-kicker">How it works</p>
                <p className="pg-body mt-2 text-sm">
                  For your privacy we never show bookings on this page. The link goes only to the
                  email address saved on the booking and usually arrives within a few minutes.
                </p>
              </div>
            </div>
          </GuestPanel>
        }
      />
      <GuestContent>
        <GuestPanel className="max-w-xl p-5 sm:p-6">
          <FindBookingForm venues={venues} initialVenueSlug={initialVenueSlug} />
        </GuestPanel>
      </GuestContent>
    </GuestPageFrame>
  );
}
