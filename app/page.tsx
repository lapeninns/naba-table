import type { Metadata } from "next";

import type { RestaurantSummary } from "@/lib/restaurants/types";
import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { Navbar } from "@/components/marketing/Navbar";
import { RestaurantBrowser } from "@/components/marketing/RestaurantBrowser";
import { listRestaurants, ListRestaurantsError } from "@/server/restaurants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve a table · SajiloReserveX",
  description: "Pick a SajiloReserveX partner restaurant and book your next visit in seconds.",
};

export default async function HomePage() {
  let restaurants: RestaurantSummary[] = [];
  let loadError = false;

  try {
    restaurants = await listRestaurants();
  } catch (error) {
    loadError = true;
    if (error instanceof ListRestaurantsError) {
      console.error(error);
    } else {
      console.error("[home-reserve] unexpected error", error);
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background/98 to-background">
      <Navbar />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-12 sm:pt-16 md:gap-20 md:pb-28"
      >
        <section
          aria-labelledby="hero-heading"
          className="flex flex-col gap-8 sm:gap-10"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            SajiloReserveX
          </p>
          <div className="space-y-6">
            <h1
              id="hero-heading"
              className="scroll-m-28 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
            >
              Pick your restaurant and reserve in moments
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Explore participating SajiloReserveX locations and book a table in just a few taps.
              Sign in to revisit previous reservations and keep your preferences synced.
            </p>
          </div>
          <MarketingSessionActions
            size="lg"
            className="w-full [&>a]:w-full sm:[&>a]:w-auto"
          />
        </section>

        <section
          id="restaurants"
          aria-labelledby="restaurants-heading"
          className="flex flex-col gap-8"
        >
          <div className="space-y-3">
            <h2
              id="restaurants-heading"
              className="scroll-m-28 text-2xl font-semibold text-foreground sm:text-3xl"
            >
              Available restaurants
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Choose a partner location below to open the full reservation flow. We keep availability
              updated in real time so you can book with confidence.
            </p>
          </div>

          <RestaurantBrowser initialRestaurants={restaurants} initialError={loadError} />
        </section>
      </main>
    </div>
  );
}
