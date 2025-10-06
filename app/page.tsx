import type { Metadata } from "next";
import Link from "next/link";

import { Navbar } from "@/components/marketing/Navbar";
import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listRestaurants, ListRestaurantsError } from "@/server/restaurants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve a table · SajiloReserveX",
  description: "Pick a SajiloReserveX partner restaurant and book your next visit in seconds.",
};

type RestaurantCardProps = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
};

const formatCapacity = (capacity: number | null) => {
  if (capacity === null || capacity === undefined) return "Capacity not set";
  if (capacity <= 0) return "Capacity not set";
  return `${capacity} seats`;
};

function RestaurantCard({ name, slug, timezone, capacity }: RestaurantCardProps) {
  return (
    <li>
      <Card className="group h-full scroll-m-24 border-border/70 bg-card/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border focus-within:-translate-y-0.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/60">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg font-semibold text-foreground">{name}</CardTitle>
            <Badge variant="secondary" className="font-medium uppercase tracking-wide">
              {timezone}
            </Badge>
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            {formatCapacity(capacity)} · Select to open the booking flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/reserve/r/${slug}`}
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "w-full"
            )}
            aria-label={`Start booking at ${name}`}
          >
            Book this restaurant
          </Link>
        </CardContent>
      </Card>
    </li>
  );
}

export default async function HomePage() {
  let restaurants: RestaurantCardProps[] = [];
  let loadError = false;

  try {
    const rows = await listRestaurants();
    restaurants = rows.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      timezone: restaurant.timezone,
      capacity: restaurant.capacity,
    }));
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

          {loadError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
            >
              We couldn’t load restaurants right now. Please refresh, or contact support if the issue
              persists.
            </div>
          ) : null}

          {restaurants.length > 0 ? (
            <ul
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Partner restaurants"
            >
              {restaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} {...restaurant} />
              ))}
            </ul>
          ) : loadError ? null : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              <h3 className="text-lg font-semibold text-foreground">No restaurants available</h3>
              <p className="mt-2 text-sm">
                Check back soon or reach out to our concierge team for personalised assistance.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
