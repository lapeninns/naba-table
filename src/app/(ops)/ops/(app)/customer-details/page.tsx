import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DASHBOARD_DEFAULT_PAGE_SIZE } from "@/components/dashboard/constants";
import { OpsCustomersClient } from "@/components/features/customers";
import { queryKeys } from "@/lib/query/keys";
import { getServerComponentSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships } from "@/server/team/access";

import type { OpsRestaurantOption } from "@/types/ops";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customers · SajiloReserveX Ops",
  description: "View and export customer booking data for your restaurant.",
};

function buildDefaultSearchParams(restaurantId: string, pageSize: number): URLSearchParams {
  const params = new URLSearchParams({
    restaurantId,
    page: "1",
    pageSize: String(pageSize),
  });
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

async function prefetchOpsCustomers(queryClient: QueryClient, params: URLSearchParams) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const origin = resolveOrigin(requestHeaders);
  const url = `${origin}/api/ops/customers?${params.toString()}`;
  const keyParams = Object.fromEntries(params.entries());

  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.opsCustomers.list(keyParams),
      queryFn: async () => {
        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to prefetch ops customers (${response.status})`);
        }

        return await response.json();
      },
    });
  } catch (error) {
    console.error("[ops/customer-details] prefetch failed", error);
  }
}

function renderNoAccessState() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant access yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an owner or manager to send you an invitation so you can view customer data.
        </p>
      </div>
    </section>
  );
}

export default async function OpsCustomerDetailsPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/customer-details] failed to resolve auth", error.message);
  }

  if (!user) {
    redirect("/signin?redirectedFrom=/ops/customer-details");
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
    await prefetchOpsCustomers(queryClient, params);
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <OpsCustomersClient defaultRestaurantId={defaultRestaurant?.id ?? null} />
    </HydrationBoundary>
  );
}
