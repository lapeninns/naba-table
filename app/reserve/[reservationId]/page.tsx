import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { notFound, redirect } from 'next/navigation';

import { getServerComponentSupabaseClient } from '@/server/supabase';
import { reservationAdapter } from '@entities/reservation/adapter';

import ReservationDetailClient from './ReservationDetailClient';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ reservationId: string }>;

function sanitizeReservationId(value: string | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  return value.trim() || null;
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
    console.error('[reserve][detail] auth resolution failed', authError.message);
  }

  if (!user) {
    redirect(`/signin?redirectedFrom=/reserve/${reservationId}`);
  }

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id,restaurant_id,booking_date,start_time,end_time,start_at,end_at,booking_type,seating_preference,status,party_size,customer_name,customer_email,customer_phone,marketing_opt_in,notes,reference,client_request_id,idempotency_key,pending_ref,details,created_at,updated_at,restaurants(name)'
    )
    .eq('id', reservationId)
    .maybeSingle();

  if (error) {
    console.error('[reserve][detail] failed to fetch reservation', error.message);
    notFound();
  }

  if (!data) {
    notFound();
  }

  const reservation = reservationAdapter(data);
  const restaurantRecord = Array.isArray(data.restaurants) ? data.restaurants[0] : data.restaurants;
  const restaurantName =
    restaurantRecord && typeof restaurantRecord === 'object' && restaurantRecord !== null
      ? (restaurantRecord as { name?: unknown }).name
      : null;

  const normalizedRestaurantName = typeof restaurantName === 'string' ? restaurantName : null;

  const queryClient = new QueryClient();
  queryClient.setQueryData(['reservation', reservationId], reservation);
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <ReservationDetailClient reservationId={reservationId} restaurantName={normalizedRestaurantName} />
    </HydrationBoundary>
  );
}
