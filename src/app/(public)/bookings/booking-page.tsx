import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import ReservationDetailClient from "@/components/features/booking/detail/ReservationDetailClient";
import { env } from "@/lib/env";
import { getTrustedSiteOrigin } from "@/lib/site-url";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import {
  createSessionRecoveryAccessToken,
  validateSessionRecoveryAccessToken,
} from "@/server/security/session-recovery-access-token";
import { getServerComponentSupabaseClient } from "@/server/supabase";
import { reservationAdapter } from "@entities/reservation/adapter";
import { reservationKeys } from "@shared/api/queryKeys";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export type RouteParams = Promise<{ bookingId: string }>;
type SearchParamValue = string | string[] | undefined;
export type SearchParams = Promise<{
  token?: SearchParamValue;
  access_token?: SearchParamValue;
  accessToken?: SearchParamValue;
  [key: string]: SearchParamValue;
}>;

const shortenId = (value: string): string => (value.length > 8 ? value.slice(0, 8) : value);

const cookieHeaderFromStore = (cookieStore: Awaited<ReturnType<typeof cookies>>): string => {
  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
};

const resolveOrigin = (): string => getTrustedSiteOrigin();

const RECOVERY_COOKIE_NAME = "sr_access";

const buildCanonicalBookingPath = (bookingId: string, pathPrefix: string): string =>
  `${pathPrefix}/${bookingId}`;

const firstSearchValue = (value: SearchParamValue): string | null => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return null;
};

const buildCanonicalBookingPathWithSearch = (
  bookingId: string,
  pathPrefix: string,
  searchParams: Record<string, SearchParamValue>,
): string => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          query.append(key, entry);
        }
      }
      continue;
    }

    query.append(key, value);
  }

  const basePath = buildCanonicalBookingPath(bookingId, pathPrefix);
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
};

const buildRecoveryPath = (nextPath: string, accessToken?: string | null): string => {
  const next = encodeURIComponent(nextPath);

  if (accessToken) {
    return `/bookings/recover?access_token=${encodeURIComponent(accessToken)}&next=${next}`;
  }

  return `/bookings/recover?next=${next}`;
};

async function createRecoveryContinuationAccessToken(params: {
  userEmail: string | null | undefined;
  userPhone: string | null | undefined;
  restaurantId: string | null | undefined;
}): Promise<string | null> {
  const secret = env.security.sessionRecoveryAccessTokenSecret?.trim();
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

  if (!normalized) {
    redirect(`${pathPrefix}`);
  }

  const legacyToken = firstSearchValue(resolvedSearchParams.token) ?? null;
  const accessToken =
    firstSearchValue(resolvedSearchParams.access_token) ??
    firstSearchValue(resolvedSearchParams.accessToken) ??
    null;
  const canonicalQuerySearchParams = Object.fromEntries(
    Object.entries(resolvedSearchParams).filter(
      ([key]) => key !== "token" && key !== "access_token" && key !== "accessToken",
    ),
  );
  const canonicalBookingPath = buildCanonicalBookingPathWithSearch(
    normalized,
    pathPrefix,
    canonicalQuerySearchParams,
  );

  if (accessToken) {
    redirect(buildRecoveryPath(canonicalBookingPath, accessToken));
  }

  if (legacyToken) {
    redirect("/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED");
  }

  const supabase = await getServerComponentSupabaseClient();
  const [userResponse, cookieStore] = await Promise.all([supabase.auth.getUser(), cookies()]);
  const user = userResponse.data.user;
  const sessionRecoveryToken = cookieStore.get(RECOVERY_COOKIE_NAME)?.value ?? null;
  let hasValidSessionRecovery = false;

  if (sessionRecoveryToken) {
    const secret = env.security.sessionRecoveryAccessTokenSecret;
    if (secret) {
      const result = validateSessionRecoveryAccessToken(sessionRecoveryToken, { secret });
      hasValidSessionRecovery = result.ok;
    }
  }

  if (!user && hasValidSessionRecovery) {
    const response = await fetch(`${resolveOrigin()}/api/bookings/${normalized}`, {
      headers: {
        accept: "application/json",
        cookie: cookieHeaderFromStore(cookieStore),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      redirect(withRedirectedFrom("/auth/signin", buildRecoveryPath(canonicalBookingPath)));
    }

    const payload = await response.json().catch(() => null);
    const booking = payload?.booking;

    const continuationAccessToken = await createRecoveryContinuationAccessToken({
      userEmail: booking?.customer_email,
      userPhone: booking?.customer_phone,
      restaurantId: booking?.restaurant_id,
    });

    if (continuationAccessToken) {
      redirect(
        withRedirectedFrom(
          "/auth/signin",
          buildRecoveryPath(canonicalBookingPath, continuationAccessToken),
        ),
      );
    }
  }

  if (!user && !hasValidSessionRecovery) {
    redirect(withRedirectedFrom("/auth/signin", buildRecoveryPath(canonicalBookingPath)));
  }

  const queryClient = new QueryClient();
  if (user || hasValidSessionRecovery) {
    await prefetchReservation(queryClient, normalized);
  }
  const dehydratedState = dehydrate(queryClient);
  const initialNow = Date.now();

  // canManage is true if user is authenticated OR has valid session recovery token
  const canManage = Boolean(user) || hasValidSessionRecovery;

  return (
    <HydrationBoundary state={dehydratedState}>
      <ReservationDetailClient
        reservationId={normalized}
        restaurantName={null}
        initialNow={initialNow}
        canManage={canManage}
        signInReturnPath={canonicalBookingPath}
      />
    </HydrationBoundary>
  );
}

export default BookingDetailPage;
