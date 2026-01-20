import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import ReservationDetailClient from "@/components/features/booking/detail/ReservationDetailClient";
import { env } from "@/lib/env";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { validateSessionRecoveryAccessToken } from "@/server/security/session-recovery-access-token";
import { getServerComponentSupabaseClient } from "@/server/supabase";
import { reservationAdapter } from "@entities/reservation/adapter";
import { reservationKeys } from "@shared/api/queryKeys";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export type RouteParams = Promise<{ bookingId: string }>;
export type SearchParams = Promise<{ token?: string }>;

const shortenId = (value: string): string => (value.length > 8 ? value.slice(0, 8) : value);

const cookieHeaderFromStore = (cookieStore: Awaited<ReturnType<typeof cookies>>): string => {
  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
};

const resolveOrigin = (requestHeaders: Headers): string => {
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? getCanonicalSiteUrl();
};

async function prefetchReservation(queryClient: QueryClient, reservationId: string, token?: string | null) {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const cookieHeader = cookieHeaderFromStore(cookieStore);
  const origin = resolveOrigin(requestHeaders);

  const url = new URL(`${origin}/api/bookings/${reservationId}`);
  if (token) {
    url.searchParams.set("token", token);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: "no-store",
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
    console.error("[reservation-detail][prefetch]", error);
  }
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { bookingId } = await params;
  const safeId = bookingId?.trim() || "reservation";
  return {
    title: `Booking ${shortenId(safeId)} · Nab a Table`,
    description: "Review the latest status, timing, and actions for your Nab a Table booking.",
  };
}

export async function BookingDetailPage({
  params,
  searchParams,
  pathPrefix = "/bookings",
}: {
  params: RouteParams;
  searchParams: SearchParams;
  pathPrefix?: string;
}) {
  const { bookingId } = await params;
  const normalized = bookingId?.trim();
  const resolvedSearchParams = (await searchParams) ?? {};
  const token = resolvedSearchParams.token ?? null;

  if (!normalized) {
    redirect(`${pathPrefix}`);
  }

  // Check for session recovery token from cookie
  const cookieStore = await cookies();
  const sessionRecoveryToken = cookieStore.get("sr_access")?.value ?? null;
  let hasValidSessionRecovery = false;

  if (sessionRecoveryToken) {
    const secret = env.security.sessionRecoveryAccessTokenSecret;
    if (secret) {
      const result = validateSessionRecoveryAccessToken(sessionRecoveryToken, { secret });
      hasValidSessionRecovery = result.ok;
    }
  }

  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow access if user is authenticated, has legacy token, or has valid session recovery token
  if (!user && !token && !hasValidSessionRecovery) {
    redirect(withRedirectedFrom("/auth/signin", `${pathPrefix}/${normalized}`));
  }

  const queryClient = new QueryClient();
  if (user || token || hasValidSessionRecovery) {
    await prefetchReservation(queryClient, normalized, token);
  }
  const dehydratedState = dehydrate(queryClient);

  // canManage is true if user is authenticated OR has valid session recovery token
  const canManage = Boolean(user) || hasValidSessionRecovery;

  return (
    <HydrationBoundary state={dehydratedState}>
      <ReservationDetailClient
        reservationId={normalized}
        restaurantName={null}
        canManage={canManage}
      />
    </HydrationBoundary>
  );
}

export default BookingDetailPage;

