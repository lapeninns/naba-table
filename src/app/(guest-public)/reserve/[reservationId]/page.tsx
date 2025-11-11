import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCanonicalSiteUrl } from "@/lib/site-url";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { reservationAdapter } from "@entities/reservation/adapter";
import { reservationKeys } from "@shared/api/queryKeys";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import ReservationDetailClient from "./ReservationDetailClient";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ reservationId: string }>;

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

async function prefetchReservation(queryClient: QueryClient, reservationId: string) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const cookieHeader = cookieHeaderFromStore(cookieStore);
  const origin = resolveOrigin(requestHeaders);

  try {
    const response = await fetch(`${origin}/api/bookings/${reservationId}`, {
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
  const { reservationId } = await params;
  const safeId = reservationId?.trim() || "reservation";
  return {
    title: `Reservation ${shortenId(safeId)} · SajiloReserveX`,
    description: "Review the latest status, timing, and actions for your SajiloReserveX booking.",
  };
}

export default async function ReservationDetailPage({ params }: { params: RouteParams }) {
  const { reservationId } = await params;
  const normalized = reservationId?.trim();

  if (!normalized) {
    redirect("/reserve");
  }

  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirectedFrom("/signin", `/reserve/${normalized}`));
  }

  const queryClient = new QueryClient();
  await prefetchReservation(queryClient, normalized);
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <ReservationDetailClient reservationId={normalized} restaurantName={null} />
    </HydrationBoundary>
  );
}
