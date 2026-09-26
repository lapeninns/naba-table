import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { BookingAccessExpiredState } from '@/components/features/booking/manage/BookingAccessExpiredState';
import { getTrustedSiteOrigin } from '@/lib/site-url';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import {
  resolveGuestBookingPageGate,
  type GuestBookingPageSearchParams,
} from '@/server/bookings/guest-booking-page-gate';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import { reservationAdapter } from '@entities/reservation/adapter';
import { reservationKeys } from '@shared/api/queryKeys';

import { ReceiptClient } from './ReceiptClient';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ bookingId: string }>;
type SearchParams = Promise<GuestBookingPageSearchParams>;

const shortenId = (value: string): string => (value.length > 8 ? value.slice(0, 8) : value);

const cookieHeaderFromStore = (cookieStore: Awaited<ReturnType<typeof cookies>>): string => {
  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
};

const resolveOrigin = (): string => getTrustedSiteOrigin();

async function prefetchReservation(
  queryClient: QueryClient,
  reservationId: string,
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  const cookieHeader = cookieHeaderFromStore(cookieStore);
  const origin = resolveOrigin();

  const url = new URL(`${origin}/api/bookings/${reservationId}`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload?.booking) {
      return null;
    }

    const normalizedReservation = reservationAdapter(payload.booking);
    queryClient.setQueryData(reservationKeys.detail(reservationId), normalizedReservation);
    return normalizedReservation;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { bookingId } = await params;
  const safeId = bookingId?.trim() || 'reservation';
  return {
    title: `Receipt ${shortenId(safeId)} · Nab a Table`,
    description: 'Your booking confirmation receipt with all the details.',
  };
}

export default async function GuestBookingReceiptPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { bookingId } = await params;
  const normalized = bookingId?.trim() ?? '';
  const ownPath = `/guest/bookings/${normalized}/receipt`;
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

  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const queryClient = new QueryClient();
  const reservation = await prefetchReservation(queryClient, normalized, cookieStore);
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <ReceiptClient
        reservationId={normalized}
        hasSession={Boolean(user)}
        prefetchedStatus={reservation?.status ?? null}
      />
    </HydrationBoundary>
  );
}
