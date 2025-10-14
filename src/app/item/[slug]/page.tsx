import Link from "next/link";
import { cache } from "react";

import BookingFlowPage from "@/components/reserve/booking-flow";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRestaurantBySlug } from "@/server/restaurants";
import { DEFAULT_VENUE } from "@shared/config/venue";

import type { Metadata } from "next";

type RouteParams = Promise<{ slug: string }>;

const resolveRestaurant = cache(async (slug: string) => getRestaurantBySlug(slug));

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await resolveRestaurant(slug);

  if (!restaurant) {
    return {
      title: "Restaurant not found · SajiloReserveX",
      description: "The requested restaurant does not exist.",
    };
  }

  return {
    title: `${restaurant.name} · SajiloReserveX`,
    description: `Browse availability and start a reservation at ${restaurant.name}.`,
  };
}

export default async function RestaurantItemPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const restaurant = await resolveRestaurant(slug);

  if (!restaurant) {
    return (
      <main
        id="main-content"
        className="sr-stack-lg flex min-h-[60vh] items-center justify-center bg-[var(--sr-color-background)] px-[var(--sr-space-6)] py-[var(--sr-space-8)] text-center"
      >
        <div className="sr-stack-md max-w-xl">
          <h1 className="text-[var(--sr-font-size-2xl)] font-semibold leading-[var(--sr-line-height-tight)]">
            We can’t find that restaurant
          </h1>
          <p className="text-[var(--sr-font-size-md)] leading-[var(--sr-line-height-relaxed)] text-[var(--sr-color-text-secondary)]">
            Double-check the link or return to the browse page to pick a different venue.
          </p>
          <div className="flex justify-center">
            <Link
              href="/browse"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "min-w-[12rem] touch-manipulation"
              )}
            >
              Browse restaurants
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const initialDetails = {
    restaurantId: restaurant.id,
    restaurantSlug: slug,
    restaurantName: restaurant.name,
    restaurantTimezone: restaurant.timezone ?? DEFAULT_VENUE.timezone,
    restaurantAddress: DEFAULT_VENUE.address,
  } as const;

  return (
    <div className="bg-[var(--sr-color-background)]">
      <nav className="border-b border-[var(--sr-color-border)] bg-[var(--sr-color-surface)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--sr-color-surface)]/65">
        <div className="sr-container flex items-center justify-between gap-[var(--sr-space-3)] px-[var(--sr-space-6)] py-[var(--sr-space-3)]">
          <Link
            href="/browse"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "touch-manipulation text-[var(--sr-color-text-secondary)] hover:text-[var(--sr-color-text-primary)]"
            )}
          >
            ← All restaurants
          </Link>
          <span className="text-sm text-[var(--sr-color-text-secondary)]">
            {restaurant.timezone ?? DEFAULT_VENUE.timezone}
          </span>
        </div>
      </nav>

      <main
        id="main-content"
        tabIndex={-1}
        className="sr-container sr-stack-lg px-[var(--sr-space-6)] py-[var(--sr-space-8)]"
      >
        <div
          className="sr-stack-md text-left"
          role="region"
          aria-labelledby="restaurant-heading"
        >
          <div className="sr-stack-sm">
            <span className="inline-flex w-fit items-center justify-center rounded-full bg-primary/10 px-[var(--sr-space-3)] py-[var(--sr-space-1)] text-sm font-medium text-primary">
              Book this venue
            </span>
            <h1
              id="restaurant-heading"
              className="text-balance text-[var(--sr-font-size-3xl)] font-semibold leading-[var(--sr-line-height-tight)]"
            >
              {restaurant.name}
            </h1>
          </div>
          <p className="max-w-2xl text-[var(--sr-font-size-md)] leading-[var(--sr-line-height-relaxed)] text-[var(--sr-color-text-secondary)]">
            Reserve a table in {restaurant.timezone ?? DEFAULT_VENUE.timezone}. We keep availability in sync so
            you can confirm the perfect time in moments.
          </p>
          <dl className="flex flex-wrap gap-[var(--sr-space-4)] text-sm text-[var(--sr-color-text-secondary)]">
            <div>
              <dt className="font-medium text-[var(--sr-color-text-primary)]">Capacity</dt>
              <dd>{restaurant.capacity ? `${restaurant.capacity} seats` : "Contact for group size"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--sr-color-text-primary)]">Timezone</dt>
              <dd>{restaurant.timezone ?? DEFAULT_VENUE.timezone}</dd>
            </div>
          </dl>
        </div>

        <div
          aria-labelledby="booking-flow-heading"
          role="region"
          className="rounded-3xl border border-[var(--sr-color-border)] bg-[var(--sr-color-surface)] p-[var(--sr-space-6)] shadow-[var(--sr-shadow-lg)]"
        >
          <h2 id="booking-flow-heading" className="sr-only">
            Book a table at {restaurant.name}
          </h2>
          <BookingFlowPage initialDetails={initialDetails} layoutElement="div" />
        </div>
      </main>
    </div>
  );
}
