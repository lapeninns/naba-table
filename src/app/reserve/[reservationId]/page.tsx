import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { notFound, redirect } from 'next/navigation';

import { getReservation } from '@/server/reservations/getReservation';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import { defaultErrorReporter } from '@reserve/shared/error';
import { DEFAULT_VENUE } from '@shared/config/venue';

import { ReservationDetailClient } from './ReservationDetailClient';

import type { Reservation } from '@entities/reservation/reservation.schema';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ reservationId: string }>;

function sanitizeReservationId(value: string | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  return value.trim() || null;
}

type ReservationVenue = {
  name: string;
  address: string;
  timezone: string;
  slug?: string | null;
};

function deriveVenue(reservation: Reservation, restaurantName: string | null): ReservationVenue {
  return {
    name: restaurantName ?? reservation.restaurantName ?? DEFAULT_VENUE.name,
    address: DEFAULT_VENUE.address,
    timezone: DEFAULT_VENUE.timezone,
    slug: DEFAULT_VENUE.slug,
  };
}

function buildReservationJsonLd(reservation: Reservation, venue: ReservationVenue) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Reservation',
    reservationNumber: reservation.reference ?? reservation.id,
    reservationStatus: reservation.status,
    reservationFor: {
      '@type': 'FoodEstablishment',
      name: venue.name,
      address: venue.address,
    },
    partySize: reservation.partySize,
    startTime: reservation.startAt ? new Date(reservation.startAt).toISOString() : undefined,
  };
}

function serializeJsonLd(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const resolved = await params;
  const reservationId = sanitizeReservationId(resolved?.reservationId);
  const shortId = reservationId ? reservationId.slice(0, 8) : 'reservation';

  return {
    title: `Reservation ${shortId} · SajiloReserveX`,
    description: 'Review the latest status, timing, and actions for your SajiloReserveX booking.',
  };
}

export default async function ReservationDetailPage({ params }: { params: RouteParams }) {
  const resolved = await params;
  const reservationId = sanitizeReservationId(resolved?.reservationId);

  if (!reservationId) {
    notFound();
  }

  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    defaultErrorReporter.capture(authError, { scope: 'reservationDetail.auth' });
  }

  if (!user) {
    redirect(`/signin?redirectedFrom=/reserve/${reservationId}`);
  }

  let reservationResult;
  try {
    reservationResult = await getReservation(reservationId, { supabase });
  } catch (error) {
    defaultErrorReporter.capture(error, {
      scope: 'reservationDetail.fetch',
      reservationId,
    });
    notFound();
  }

  if (!reservationResult) {
    notFound();
  }

  const { reservation, restaurantName } = reservationResult;

  const queryClient = new QueryClient();
  queryClient.setQueryData(['reservation', reservationId], reservation);
  const dehydratedState = dehydrate(queryClient);
  const venue = deriveVenue(reservation, restaurantName);
  const structuredData = serializeJsonLd(buildReservationJsonLd(reservation, venue));

  return (
    <HydrationBoundary state={dehydratedState}>
      <ReservationDetailClient
        reservationId={reservationId}
        restaurantName={restaurantName}
        venue={venue}
        structuredData={structuredData}
      />
    </HydrationBoundary>
  );
}
