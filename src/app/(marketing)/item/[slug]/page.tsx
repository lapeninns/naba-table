import Link from "next/link";
import { cache } from "react";

import BookingFlowPage from "@/components/reserve/booking-flow";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRestaurantBySlug } from "@/server/restaurants";
import { getInitialCalendarMask } from "@/server/restaurants/calendarMask";
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
      <section className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-6 py-16 text-center">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-slate-900">We can’t find that restaurant</h1>
          <p className="text-base text-slate-600">
            Double-check the link or return to the browse page to pick a different venue.
          </p>
          <div className="flex justify-center">
            <Link
              href="/restaurants"
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "min-w-[12rem] touch-manipulation")}
            >
              Browse restaurants
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const timezone = restaurant.timezone ?? DEFAULT_VENUE.timezone;

  const initialDetails = {
    restaurantId: restaurant.id,
    restaurantSlug: slug,
    restaurantName: restaurant.name,
    restaurantTimezone: timezone,
    restaurantAddress: DEFAULT_VENUE.address,
  } as const;

  const initialCalendarMask = await getInitialCalendarMask({
    restaurantId: restaurant.id,
    timezone,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-4 sm:px-8 lg:px-10">
          <Link
            href="/restaurants"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "touch-manipulation text-slate-700")}
          >
            ← All restaurants
          </Link>
          <span className="text-sm text-slate-500">Local timezone</span>
        </div>
      </nav>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
        <header className="space-y-4" role="region" aria-labelledby="restaurant-heading">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Book this venue
            </Badge>
            <span className="text-sm text-slate-500">Instant confirmation</span>
          </div>
          <div className="space-y-2">
            <h1 id="restaurant-heading" className="text-balance text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
              {restaurant.name}
            </h1>
            <p className="max-w-2xl text-base text-slate-700 sm:text-lg">
              Reserve a table with live availability and instant confirmation so you can lock the perfect time in moments.
            </p>
          </div>
          <dl className="flex flex-wrap gap-6 text-sm text-slate-600">
            <div>
              <dt className="font-medium text-slate-900">Capacity</dt>
              <dd>{restaurant.capacity ? `${restaurant.capacity} seats` : "Contact for group size"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Timezone</dt>
              <dd>{restaurant.timezone ?? DEFAULT_VENUE.timezone}</dd>
            </div>
          </dl>
        </header>

        <div
          aria-labelledby="booking-flow-heading"
          role="region"
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <h2 id="booking-flow-heading" className="sr-only" aria-describedby="restaurant-heading">
            Booking flow
          </h2>
          <BookingFlowPage
            initialDetails={initialDetails}
            layoutElement="div"
            initialCalendarMask={initialCalendarMask}
          />
        </div>
      </section>
    </div>
  );
}
