import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";

import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { RestaurantBrowser } from "@/components/marketing/RestaurantBrowser";
import { buttonVariants } from "@/components/ui/button";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { listRestaurants, ListRestaurantsError } from "@/server/restaurants";

import type { RestaurantSummary } from "@/lib/restaurants/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create a reservation · SajiloReserveX",
  description: "Choose a partner venue and start a new reservation with live availability.",
};

export default async function CreateReservationPage() {
  let restaurants: RestaurantSummary[] = [];
  let loadError = false;

  try {
    restaurants = await listRestaurants();
  } catch (error) {
    loadError = true;
    if (error instanceof ListRestaurantsError) {
      console.error(error);
    } else {
      console.error("[create-reserve] unexpected error", error);
    }
  }

  const queryClient = new QueryClient();
  if (!loadError) {
    queryClient.setQueryData(queryKeys.restaurants.list({}), restaurants);
  }
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="bg-[var(--sr-color-background)]">
        <div className="sr-container sr-stack-lg min-h-screen px-[var(--sr-space-6)] py-[var(--sr-space-8)]">
          <header className="sr-stack-md text-left">
            <span className="inline-flex w-fit items-center justify-center rounded-full bg-primary/10 px-[var(--sr-space-3)] py-[var(--sr-space-1)] text-sm font-medium text-primary">
              Plan your night
            </span>
            <div className="sr-stack-sm">
              <h1 className="text-balance text-[var(--sr-font-size-3xl)] font-semibold leading-[var(--sr-line-height-tight)]">
                Create a new reservation
              </h1>
              <p className="max-w-2xl text-[var(--sr-font-size-md)] leading-[var(--sr-line-height-relaxed)] text-[var(--sr-color-text-secondary)]">
                Filter by timezone or party size, then pick a venue to open the booking flow. You can
                return to this page anytime to schedule another visit.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-[var(--sr-space-3)]">
              <MarketingSessionActions
                mode="account"
                size="lg"
                showSecondary
                className="w-full justify-start sm:w-auto"
              />
              <a
                href="#create-browser"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "touch-manipulation"
                )}
              >
                Jump to availability
              </a>
            </div>
          </header>

          <section
            id="create-browser"
            className="sr-stack-lg rounded-3xl border border-[var(--sr-color-border)] bg-[var(--sr-color-surface)] p-[var(--sr-space-6)] shadow-[var(--sr-shadow-lg)]"
            aria-labelledby="create-browser-heading"
          >
            <div className="sr-stack-sm text-left">
              <h2
                id="create-browser-heading"
                className="text-[var(--sr-font-size-2xl)] font-semibold leading-[var(--sr-line-height-tight)]"
              >
                Pick a partner venue
              </h2>
              <p className="max-w-2xl text-[var(--sr-font-size-sm)] text-[var(--sr-color-text-secondary)]">
                Availability updates in real time. Enter your filters and select a restaurant to start the
                guided checkout.
              </p>
            </div>
            <RestaurantBrowser initialData={restaurants} initialError={loadError} />
          </section>
        </div>
      </div>
    </HydrationBoundary>
  );
}
