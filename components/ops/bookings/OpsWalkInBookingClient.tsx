'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import BookingFlowPage from '@/components/reserve/booking-flow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type OpsRestaurant = {
  id: string;
  name: string;
  timezone: string;
  address: string;
};

type OpsWalkInBookingClientProps = {
  restaurants: OpsRestaurant[];
};

export function OpsWalkInBookingClient({ restaurants }: OpsWalkInBookingClientProps) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    restaurants[0]?.id ?? null,
  );

  const selectedRestaurant = useMemo(() => {
    if (!selectedRestaurantId) {
      return restaurants[0] ?? null;
    }
    return restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null;
  }, [restaurants, selectedRestaurantId]);

  if (!selectedRestaurant) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
        <Card className="border-border/60 bg-muted/20">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">No restaurant access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Your account is not linked to any restaurants yet.</p>
            <p>Please ask an owner or manager to add you to their team.</p>
            <Button asChild variant="secondary">
              <Link href="/ops">Return to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const initialDetails = {
    restaurantId: selectedRestaurant.id,
    restaurantName: selectedRestaurant.name,
    restaurantAddress: selectedRestaurant.address,
    restaurantTimezone: selectedRestaurant.timezone,
    rememberDetails: false,
    marketingOptIn: false,
    agree: true,
  } as const;

  return (
    <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create walk-in booking</h1>
            <p className="text-sm text-muted-foreground">
              Log a guest who arrived without a reservation. Email confirmation is sent only when an address is provided.
            </p>
          </div>
          <Button asChild variant="outline" className="touch-manipulation">
            <Link href="/ops">← Back to dashboard</Link>
          </Button>
        </div>

        {restaurants.length > 1 ? (
          <div className="flex w-full flex-col gap-2 sm:max-w-xs">
            <label htmlFor="ops-walkin-restaurant" className="text-sm font-medium text-foreground">
              Restaurant
            </label>
            <select
              id="ops-walkin-restaurant"
              value={selectedRestaurant.id}
              onChange={(event) => setSelectedRestaurantId(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-6xl">
        <BookingFlowPage
          key={selectedRestaurant.id}
          initialDetails={initialDetails}
          mode="ops"
        />
      </div>
    </main>
  );
}
