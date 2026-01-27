import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import ReservationDetailClient from '@/components/features/booking/detail/ReservationDetailClient';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import { reservationAdapter } from '@entities/reservation/adapter';
import { reservationKeys } from '@shared/api/queryKeys';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ bookingId: string }>;
type SearchParams = Promise<{ token?: string; access_token?: string; accessToken?: string }>;

const shortenId = (value: string): string => (value.length > 8 ? value.slice(0, 8) : value);

const cookieHeaderFromStore = (cookieStore: Awaited<ReturnType<typeof cookies>>): string => {
  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
};

const resolveOrigin = (requestHeaders: Headers): string => {
  const forwardedHost = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const forwardedProto = requestHeaders.get('x-forwarded-proto');
  if (forwardedHost) {
    return `${forwardedProto ?? 'https'}://${forwardedHost}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? getCanonicalSiteUrl();
};

async function prefetchReservation(queryClient: QueryClient, reservationId: string) {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const cookieHeader = cookieHeaderFromStore(cookieStore);
  const origin = resolveOrigin(requestHeaders);

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
      return;
    }

    const payload = await response.json();
    if (!payload?.booking) {
      return;
    }

    const normalizedReservation = reservationAdapter(payload.booking);
    queryClient.setQueryData(reservationKeys.detail(reservationId), normalizedReservation);
  } catch (error) {
    console.error('[reservation-detail][prefetch]', error);
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

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { bookingId } = await params;
  const normalized = bookingId?.trim();
  const resolvedSearchParams = (await searchParams) ?? {};
  const legacyToken = resolvedSearchParams.token ?? null;
  const accessToken = resolvedSearchParams.access_token ?? resolvedSearchParams.accessToken ?? null;

  if (!normalized) {
    redirect('/bookings');
  }

  if (accessToken) {
    const next = encodeURIComponent(`/bookings/${normalized}`);
    redirect(`/bookings/recover?access_token=${encodeURIComponent(accessToken)}&next=${next}`);
  }

  if (legacyToken) {
    redirect('/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED');
  }

  const supabase = await getServerComponentSupabaseClient();
  const [userResponse, cookieStore] = await Promise.all([supabase.auth.getUser(), cookies()]);
  const user = userResponse.data.user;
  const hasRecoveryCookie = Boolean(cookieStore.get('sr_access')?.value);

  if (!user && !hasRecoveryCookie) {
    redirect(withRedirectedFrom('/auth/signin', `/bookings/${normalized}`));
  }

  const queryClient = new QueryClient();
  // Prefetch only when authenticated or recovery cookie provided
  if (user || hasRecoveryCookie) {
    await prefetchReservation(queryClient, normalized);
  }
  const dehydratedState = dehydrate(queryClient);
  const initialNow = Date.now();

  return (
    <HydrationBoundary state={dehydratedState}>
      <ReservationDetailClient
        reservationId={normalized}
        restaurantName={null}
        initialNow={initialNow}
        canManage={Boolean(user) || hasRecoveryCookie}
      />
    </HydrationBoundary>
  );
}
