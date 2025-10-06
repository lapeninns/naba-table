import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listRestaurants, ListRestaurantsError } from '@/server/restaurants';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reserve a table · SajiloReserveX',
  description: 'Choose a restaurant to start a reservation with SajiloReserveX.',
};

type RestaurantCardProps = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
};

const formatCapacity = (capacity: number | null) => {
  if (capacity === null || capacity === undefined) return 'Capacity not set';
  if (capacity <= 0) return 'Capacity not set';
  return `${capacity} seats`;
};

function RestaurantCard({ name, slug, timezone, capacity }: RestaurantCardProps) {
  return (
    <li>
      <Card
        className="group h-full scroll-m-16 border-border/60 bg-card/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border focus-within:-translate-y-0.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/60"
      >
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
          <Button
            asChild
            variant="primary"
            className="w-full"
            aria-label={`Start booking at ${name}`}
          >
            <Link href={`/reserve/r/${slug}`} className="inline-flex w-full items-center justify-center">
              Book this restaurant
            </Link>
          </Button>
        </CardContent>
      </Card>
    </li>
  );
}

export default async function ReserveIndexPage() {
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
      console.error('[reserve-index] unexpected error', error);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-16">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          SajiloReserveX
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Pick your restaurant
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Browse participating locations and jump straight into the reservation flow with a single
          click.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          We couldn’t load restaurants right now. Please refresh, or contact support if the issue
          persists.
        </div>
      ) : null}

      {restaurants.length > 0 ? (
        <ul
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Available restaurants"
        >
          {restaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} {...restaurant} />
          ))}
        </ul>
      ) : loadError ? null : (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">No restaurants available</h2>
          <p className="mt-2 text-sm">
            Check back soon or reach out to our concierge team for personalised assistance.
          </p>
        </div>
      )}
    </main>
  );
}
