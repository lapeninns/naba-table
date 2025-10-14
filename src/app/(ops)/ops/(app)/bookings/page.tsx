import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OpsBookingsClient } from "@/components/features/bookings";
import type { OpsStatusFilter } from "@/hooks";
import { getServerComponentSupabaseClient } from "@/server/supabase";

export const metadata: Metadata = {
  title: "Manage bookings · SajiloReserveX Ops",
  description: "Review and update upcoming reservations for your restaurant team.",
};

type OpsBookingsSearchParams = {
  restaurantId?: string;
  filter?: string;
  page?: string;
  pageSize?: string;
  status?: string;
  query?: string;
};

const VALID_FILTERS: OpsStatusFilter[] = [
  "all",
  "upcoming",
  "past",
  "cancelled",
  "pending",
  "pending_allocation",
  "confirmed",
  "completed",
  "no_show",
];

function parseStatusFilter(raw: string | undefined): OpsStatusFilter | null {
  if (!raw) return null;
  return VALID_FILTERS.includes(raw as OpsStatusFilter) ? (raw as OpsStatusFilter) : null;
}

export default async function OpsBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<OpsBookingsSearchParams>;
}) {
  const resolvedParams = (await searchParams) ?? {};

  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/bookings] failed to resolve auth", error.message);
  }

  if (!user) {
    redirect("/signin?redirectedFrom=/ops/bookings");
  }

  const initialFilter = parseStatusFilter(resolvedParams.filter ?? resolvedParams.status);
  const parsedPage = resolvedParams.page ? Number.parseInt(resolvedParams.page, 10) : NaN;
  const initialPage = Number.isNaN(parsedPage) || parsedPage <= 0 ? null : parsedPage;
  const initialRestaurantId = resolvedParams.restaurantId ?? null;
  const rawQuery = resolvedParams.query?.trim() ?? "";
  const initialQuery = rawQuery.length > 0 ? rawQuery : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 py-6">
      <OpsBookingsClient
        initialFilter={initialFilter}
        initialPage={initialPage}
        initialRestaurantId={initialRestaurantId}
        initialQuery={initialQuery}
      />
    </div>
  );
}
