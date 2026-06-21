import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { env } from '@/lib/env';
import { getTrustedSiteOrigin } from '@/lib/site-url';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { validateSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import { reservationAdapter } from '@entities/reservation/adapter';
import { reservationKeys } from '@shared/api/queryKeys';

import { ReceiptClient } from './ReceiptClient';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ bookingId: string }>;
type SearchParams = Promise<{ access_token?: string; accessToken?: string; token?: string }>;

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
  } catch (error) {
    console.error('[receipt][prefetch]', error);
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
  const normalized = bookingId?.trim();
  const resolvedSearchParams = (await searchParams) ?? {};
  const accessToken = resolvedSearchParams.access_token ?? resolvedSearchParams.accessToken ?? null;
  const legacyToken = resolvedSearchParams.token ?? null;

  if (!normalized) {
    redirect('/guest/bookings');
  }

  if (legacyToken && !accessToken) {
    redirect('/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED');
  }

  if (accessToken) {
    const recoverUrl = new URL('/bookings/recover', resolveOrigin());
    recoverUrl.searchParams.set('access_token', accessToken);
    recoverUrl.searchParams.set('next', `/guest/bookings/${normalized}/receipt`);
    redirect(`${recoverUrl.pathname}${recoverUrl.search}`);
  }

  const supabase = await getServerComponentSupabaseClient();
  const [userResponse, cookieStore] = await Promise.all([supabase.auth.getUser(), cookies()]);
  const user = userResponse.data.user;
  const recoveryCookie = cookieStore.get('sr_access')?.value ?? null;
  const recoverySecret = env.security.sessionRecoveryAccessTokenSecret;
  const hasRecoveryCookie =
    Boolean(recoveryCookie) &&
    Boolean(recoverySecret) &&
    validateSessionRecoveryAccessToken(recoveryCookie!, { secret: recoverySecret! }).ok;

  // Require either auth or an established recovery cookie for receipt access.
  if (!user && !hasRecoveryCookie) {
    redirect(withRedirectedFrom('/auth/signin', `/guest/bookings/${normalized}/receipt`));
  }

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
