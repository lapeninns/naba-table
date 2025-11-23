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
  const restaurantCount = restaurants.length;

  if (!loadError) {
    queryClient.setQueryData(queryKeys.restaurants.list({}), restaurants);
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <main className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="pointer-events-none absolute inset-x-0 top-[-12rem] h-[18rem] bg-gradient-to-b from-primary/15 via-transparent to-transparent blur-3xl" aria-hidden />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-8 lg:px-10 lg:py-16">
          <section className="grid gap-10 text-left lg:grid-cols-[1.05fr_0.95fr] lg:items-center" aria-labelledby="restaurant-hero-heading">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                Curated partner venues
              </div>
              <div className="space-y-4">
                <h1 id="restaurant-hero-heading" className="text-balance text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                  Reserve remarkable tables in seconds
                </h1>
                <p className="max-w-2xl text-base text-slate-700 sm:text-lg">
                  Browse live availability, compare by timezone or party size, and jump straight into the booking flow
                  with instant confirmation.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="#restaurant-directory"
                  className={cn(buttonVariants({ variant: "default", size: "lg" }), "touch-manipulation")}
                >
                  Browse restaurants
                </Link>
                <Link
                  href="/guest/bookings"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "touch-manipulation")}
                >
                  My bookings
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  Live availability
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                  Instant confirmation
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  Concierge support
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Ready to dine?</p>
                  <p className="text-base text-slate-700">Choose a venue and open the reservation flow without losing your filters.</p>
                </div>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                  Seamless
                </Badge>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Avg confirmation</p>
                  <p className="text-2xl font-semibold text-slate-900">&lt; 10s</p>
                  <p className="text-xs text-slate-500">Most guests book in under ten seconds.</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Seats ready now</p>
                  <p className="text-2xl font-semibold text-slate-900">{restaurantCount || "Live"}</p>
                  <p className="text-xs text-slate-500">Real-time inventory from our partners.</p>
                </div>
              </div>
              <div className="mt-5 space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-emerald-600">✓</span>
                  Hold times removed—jump straight to times that fit.
                </div>
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-emerald-600">✓</span>
                  See timezone + capacity at a glance.
                </div>
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-emerald-600">✓</span>
                  Modify or cancel in just a few taps.
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">We coordinate directly with each venue so your spot is confirmed instantly.</p>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              Real-time directory
            </span>
            <p className="text-sm text-slate-700">
              Compare restaurants by search, timezone, or party size—then jump into the booking flow without losing context.
            </p>
          </div>

          <section
            id="restaurant-directory"
            className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-xl"
            aria-labelledby="restaurant-directory-heading"
          >
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Directory</p>
                  <h2
                    id="restaurant-directory-heading"
                    className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl"
                  >
                    Browse partner restaurants
                  </h2>
                  <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                    Availability updates in real time. Use the filters below, then select a restaurant to launch the
                    SajiloReserveX checkout experience.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                  <span className="font-medium">{restaurantCount > 0 ? `${restaurantCount} venues live` : "Live updating"}</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-6 sm:px-8 lg:px-10">
              <RestaurantBrowser initialData={restaurants} initialError={loadError} />
            </div>
          </section>
        </div>
      </main>
    </HydrationBoundary>
  );
}
