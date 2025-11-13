import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import Link from "next/link";

import { RestaurantBrowser } from "@/components/marketing/RestaurantBrowser";
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
    "Scroll through SajiloReserveX partner venues, filter by timezone or party size, and jump straight into the booking flow.",
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
      <div className="bg-[var(--sr-color-background)]">
        <div className="sr-container sr-stack-xl min-h-screen px-[var(--sr-space-6)] py-[var(--sr-space-10)]">
          <header className="sr-stack-md text-left">
            <span className="inline-flex w-fit items-center justify-center rounded-full bg-primary/10 px-[var(--sr-space-3)] py-[var(--sr-space-1)] text-sm font-medium text-primary">
              Discover & book
            </span>
            <div className="sr-stack-sm">
              <h1 className="text-balance text-[var(--sr-font-size-3xl)] font-semibold leading-[var(--sr-line-height-tight)]">
                Browse partner restaurants
              </h1>
              <p className="max-w-2xl text-[var(--sr-font-size-md)] leading-[var(--sr-line-height-relaxed)] text-[var(--sr-color-text-secondary)]">
                Search by name, timezone, or party size. Select a venue to open the booking flow and confirm your table in seconds.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-[var(--sr-space-3)]">
              <Link
                href="#restaurant-directory"
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "touch-manipulation")}
              >
                Jump to directory
              </Link>
              <Link
                href="/reserve"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "touch-manipulation")}
              >
                Go straight to booking
              </Link>
            </div>
          </header>

          <section
            id="restaurant-directory"
            className="sr-stack-lg rounded-3xl border border-[var(--sr-color-border)] bg-[var(--sr-color-surface)] p-[var(--sr-space-6)] shadow-[var(--sr-shadow-lg)]"
            aria-labelledby="restaurant-directory-heading"
          >
            <div className="sr-stack-sm text-left">
              <h2
                id="restaurant-directory-heading"
                className="text-[var(--sr-font-size-2xl)] font-semibold leading-[var(--sr-line-height-tight)]"
              >
                Find a table
              </h2>
              <p className="max-w-2xl text-[var(--sr-font-size-sm)] text-[var(--sr-color-text-secondary)]">
                Availability updates in real time. Use the filters below, then select a restaurant to launch the SajiloReserveX checkout experience.
              </p>
            </div>
            <RestaurantBrowser initialData={restaurants} initialError={loadError} />
          </section>
        </div>
      </div>
    </HydrationBoundary>
  );
}
