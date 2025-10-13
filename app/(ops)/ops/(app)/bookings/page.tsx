import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";

import config from "@/config";
import { OpsBookingsClient as LegacyOpsBookingsClient, type OpsRestaurantOption } from "@/components/ops/bookings/OpsBookingsClient";
import { OpsBookingsClient } from "@/components/features/bookings";
import type { OpsStatusFilter } from "@/hooks";
import { DASHBOARD_DEFAULT_PAGE_SIZE } from "@/components/dashboard/constants";
import { queryKeys } from "@/lib/query/keys";
import { fetchUserMemberships } from "@/server/team/access";
import { getServerComponentSupabaseClient } from "@/server/supabase";

export const metadata: Metadata = {
  title: "Manage bookings · SajiloReserveX Ops",
  description: "Review and update upcoming reservations for your restaurant team.",
};

function buildDefaultSearchParams(restaurantId: string, pageSize: number): URLSearchParams {
  const params = new URLSearchParams({
    restaurantId,
    page: "1",
    pageSize: String(pageSize),
    sort: "asc",
  });
  params.set("from", new Date().toISOString());
  return params;
}

type HeaderLike = {
  get(name: string): string | null | undefined;
};

function resolveOrigin(requestHeaders: HeaderLike): string {
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const origin = requestHeaders.get("origin");

  if (origin) {
    return origin;
  }

  if (forwardedHost) {
    const protocol = forwardedProto ?? "https";
    return `${protocol}://${forwardedHost}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

type OpsBookingsSearchParams = {
  restaurantId?: string;
  filter?: string;
  page?: string;
  pageSize?: string;
  status?: string;
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

async function prefetchOpsBookings(queryClient: QueryClient, params: URLSearchParams) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const origin = resolveOrigin(requestHeaders);
  const url = `${origin}/api/ops/bookings?${params.toString()}`;
  const keyParams = Object.fromEntries(params.entries());

  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.opsBookings.list(keyParams),
      queryFn: async () => {
        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to prefetch ops bookings (${response.status})`);
        }

        return await response.json();
      },
    });
  } catch (error) {
    console.error("[ops/bookings] prefetch failed", error);
  }
}

function renderNoAccessState() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant access yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an owner or manager to send you an invitation so you can manage bookings.
        </p>
      </div>
    </section>
  );
}

export default async function OpsBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<OpsBookingsSearchParams>;
}) {
  const resolvedParams = (await searchParams) ?? {};
  const useNewOpsExperience = config.flags?.opsV5 ?? false;

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

  if (useNewOpsExperience) {
    const initialFilter = parseStatusFilter(resolvedParams.filter ?? resolvedParams.status);
    const parsedPage = resolvedParams.page ? Number.parseInt(resolvedParams.page, 10) : NaN;
    const initialPage = Number.isNaN(parsedPage) || parsedPage <= 0 ? null : parsedPage;
    const initialRestaurantId = resolvedParams.restaurantId ?? null;

    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-8 py-6">
        <OpsBookingsClient
          initialFilter={initialFilter}
          initialPage={initialPage}
          initialRestaurantId={initialRestaurantId}
        />
      </div>
    );
  }

  const memberships = await fetchUserMemberships(user.id, supabase);

  if (memberships.length === 0) {
    return renderNoAccessState();
  }

  const restaurants: OpsRestaurantOption[] = memberships
    .map((membership) => {
      if (!membership.restaurant_id) return null;
      return {
        id: membership.restaurant_id,
        name: membership.restaurants?.name ?? "Restaurant",
      };
    })
    .filter((restaurant): restaurant is OpsRestaurantOption => Boolean(restaurant));

  const defaultRestaurant = restaurants[0] ?? null;
  const queryClient = new QueryClient();

  if (defaultRestaurant) {
    const params = buildDefaultSearchParams(defaultRestaurant.id, DASHBOARD_DEFAULT_PAGE_SIZE);
    await prefetchOpsBookings(queryClient, params);
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <LegacyOpsBookingsClient restaurants={restaurants} defaultRestaurantId={defaultRestaurant?.id ?? null} />
    </HydrationBoundary>
  );
}
