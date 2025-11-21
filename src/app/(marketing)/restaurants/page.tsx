import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import Link from "next/link";

import { RestaurantBrowser } from "@/components/marketing/RestaurantBrowser";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { listRestaurants, ListRestaurantsError } from "@/server/restaurants";

import type { RestaurantSummary } from "@/lib/restaurants/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse partner restaurants · SajiloReserveX",
  description:
    "Search SajiloReserveX partner venues, filter by party size or timezone, and open the booking flow instantly.",
};

async function loadRestaurants() {
  let restaurants: RestaurantSummary[] = [];
  let loadError = false;

  try {
    restaurants = await listRestaurants();
  } catch (error) {
    loadError = true;
    if (error instanceof ListRestaurantsError) {
      console.error("[restaurant-directory] failed to load restaurants", error);
    } else {
      console.error("[restaurant-directory] unexpected error", error);
    }
  }

  return { restaurants, loadError };
}

export default async function RestaurantDirectoryPage() {
  const { restaurants, loadError } = await loadRestaurants();
  const queryClient = new QueryClient();

  if (!loadError) {
    queryClient.setQueryData(queryKeys.restaurants.list({}), restaurants);
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-8 lg:px-10 lg:py-16">
          <header className="space-y-5 text-left">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Discover & book
              </Badge>
              <span className="text-sm text-slate-500">Live availability · Instant confirmation</span>
            </div>
            <div className="space-y-3">
              <h1 className="text-balance text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                Browse partner restaurants
              </h1>
              <p className="max-w-2xl text-base text-slate-700 sm:text-lg">
                Search by name, timezone, or party size. Select a venue to launch the booking flow and confirm your table
                in seconds.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="#restaurant-directory"
                className={cn(buttonVariants({ variant: "default", size: "lg" }), "touch-manipulation")}
              >
                Jump to directory
              </Link>
              <Link
                href="/guest/bookings"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "touch-manipulation")}
              >
                My Bookings
              </Link>
            </div>
          </header>

          <section
            id="restaurant-directory"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10"
            aria-labelledby="restaurant-directory-heading"
          >
            <div className="space-y-2 text-left">
              <h2
                id="restaurant-directory-heading"
                className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl"
              >
                Find a table
              </h2>
              <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                Availability updates in real time. Use the filters below, then select a restaurant to launch the
                SajiloReserveX checkout experience.
              </p>
            </div>
            <div className="mt-6">
              <RestaurantBrowser initialData={restaurants} initialError={loadError} />
            </div>
          </section>
        </div>
      </div>
    </HydrationBoundary>
  );
}
