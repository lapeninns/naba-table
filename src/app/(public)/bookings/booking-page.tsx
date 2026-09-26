import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import ReservationDetailClient from '@/components/features/booking/detail/ReservationDetailClient';
import { BookingAccessExpiredState } from '@/components/features/booking/manage/BookingAccessExpiredState';
import { getTrustedSiteOrigin } from '@/lib/site-url';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import {
  resolveGuestBookingPageGate,
  type GuestBookingPageSearchParams,
} from '@/server/bookings/guest-booking-page-gate';
import { reservationAdapter } from '@entities/reservation/adapter';
import { reservationKeys } from '@shared/api/queryKeys';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export type RouteParams = Promise<{ bookingId: string }>;
export type SearchParams = Promise<GuestBookingPageSearchParams>;

const shortenId = (value: string): string => (value.length > 8 ? value.slice(0, 8) : value);

const cookieHeaderFromStore = (cookieStore: Awaited<ReturnType<typeof cookies>>): string => {
  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
};

/**
 * Server-side prefetch through the booking API with the browser's cookies.
 * Guest token limits are per booking, so this does not starve the client.
 */
async function prefetchReservation(
  queryClient: QueryClient,
  reservationId: string,
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  const cookieHeader = cookieHeaderFromStore(cookieStore);
  const url = new URL(`${getTrustedSiteOrigin()}/api/bookings/${reservationId}`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    if (!payload?.booking) {
      return;
    }

    queryClient.setQueryData(
      reservationKeys.detail(reservationId),
      reservationAdapter(payload.booking),
    );
  } catch {
    // The client refetches; the page still renders.
  }
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { bookingId } = await params;
  const safeId = bookingId?.trim() || 'reservation';
  return {
    title: `Booking ${shortenId(safeId)} · Nab a Table`,
    description: 'Review the latest status, timing, and actions for your Nab a Table booking.',
  };
}

export async function BookingDetailPage({
  params,
  searchParams,
  pathPrefix = '/bookings',
}: {
  params: RouteParams;
  searchParams: SearchParams;
  pathPrefix?: string;
}) {
  const { bookingId } = await params;
  const normalized = bookingId?.trim() ?? '';
  const ownPath = `${pathPrefix}/${normalized}`;
  const cookieStore = await cookies();

  const gate = await resolveGuestBookingPageGate({
    bookingId: normalized,
    ownPath,
    searchParams: (await searchParams) ?? {},
    cookies: cookieStore,
  });

  if (gate.kind === 'redirect') {
    redirect(gate.location);
  }
  if (gate.kind === 'sign_in') {
    redirect(withRedirectedFrom('/auth/signin', ownPath));
  }
  if (gate.kind === 'denied') {
    return (
      <BookingAccessExpiredState reason={gate.reason} isAuthenticated={gate.isAuthenticated} />
    );
  }

  const queryClient = new QueryClient();
  await prefetchReservation(queryClient, normalized, cookieStore);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReservationDetailClient
        reservationId={normalized}
        restaurantName={null}
        initialNow={Date.now()}
        canManage
      />
    </HydrationBoundary>
  );
}

export default BookingDetailPage;
