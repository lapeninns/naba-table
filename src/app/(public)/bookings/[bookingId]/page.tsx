import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import ReservationDetailClient from '@/components/features/booking/detail/ReservationDetailClient';
import { getTrustedSiteOrigin } from '@/lib/site-url';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
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

const resolveOrigin = (): string => getTrustedSiteOrigin();

const RECOVERY_COOKIE_NAME = 'sr_access';

const buildCanonicalBookingPath = (bookingId: string): string => `/bookings/${bookingId}`;

const buildRecoveryPath = (bookingId: string, accessToken?: string | null): string => {
  const next = encodeURIComponent(buildCanonicalBookingPath(bookingId));

  if (accessToken) {
    return `/bookings/recover?access_token=${encodeURIComponent(accessToken)}&next=${next}`;
  }

  return `/bookings/recover?next=${next}`;
};

const buildRecoveryRedirectPath = (bookingId: string, accessToken?: string | null): string =>
  withRedirectedFrom('/auth/signin', buildRecoveryPath(bookingId, accessToken));

async function createRecoveryContinuationAccessToken(params: {
  userEmail: string | null | undefined;
  userPhone: string | null | undefined;
  restaurantId: string | null | undefined;
}): Promise<string | null> {
  const secret = process.env.SESSION_RECOVERY_ACCESS_TOKEN_SECRET?.trim();
  if (!secret) return null;

  const { userEmail, userPhone, restaurantId } = params;
  if (!restaurantId || !userEmail || !userPhone) {
    return null;
  }

  return createSessionRecoveryAccessToken({
    restaurantId,
    email: userEmail,
    phone: userPhone,
    secret,
  });
}

async function prefetchReservation(queryClient: QueryClient, reservationId: string) {
  const cookieStore = await cookies();
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
    redirect(buildRecoveryPath(normalized, accessToken));
  }

  if (legacyToken) {
    redirect('/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED');
  }

  const supabase = await getServerComponentSupabaseClient();
  const [userResponse, cookieStore] = await Promise.all([supabase.auth.getUser(), cookies()]);
  const user = userResponse.data.user;
  const recoveryCookie = cookieStore.get(RECOVERY_COOKIE_NAME)?.value ?? null;
  const hasRecoveryCookie = Boolean(recoveryCookie);

  if (!user && hasRecoveryCookie) {
    const response = await fetch(`${resolveOrigin()}/api/bookings/${normalized}`, {
      headers: {
        accept: 'application/json',
        cookie: cookieHeaderFromStore(cookieStore),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      redirect(buildRecoveryRedirectPath(normalized));
    }

    const payload = await response.json().catch(() => null);
    const booking = payload?.booking;

    const continuationAccessToken = await createRecoveryContinuationAccessToken({
      userEmail: booking?.customer_email,
      userPhone: booking?.customer_phone,
      restaurantId: booking?.restaurant_id,
    });

    if (continuationAccessToken) {
      redirect(buildRecoveryRedirectPath(normalized, continuationAccessToken));
    }
  }

  if (!user && !hasRecoveryCookie) {
    redirect(buildRecoveryRedirectPath(normalized));
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
        signInReturnPath={buildCanonicalBookingPath(normalized)}
      />
    </HydrationBoundary>
  );
}
