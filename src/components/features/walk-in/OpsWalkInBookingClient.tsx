'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import BookingFlowPage from '@/components/reserve/booking-flow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantsList } from '@/hooks';

export function OpsWalkInBookingClient() {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const { data: restaurants, isLoading, isError } = useOpsRestaurantsList({ enabled: memberships.length > 0 });
  const searchParams = useSearchParams();

  const accessibleRestaurantIds = useMemo(() => new Set(memberships.map((membership) => membership.restaurantId)), [memberships]);

  const availableRestaurants = useMemo(() => {
    if (!restaurants) return [];
    return restaurants.filter((restaurant) => accessibleRestaurantIds.has(restaurant.id));
  }, [accessibleRestaurantIds, restaurants]);

  const selectedRestaurantId = useMemo(() => {
    if (activeRestaurantId && accessibleRestaurantIds.has(activeRestaurantId)) {
      return activeRestaurantId;
    }
    return availableRestaurants[0]?.id ?? null;
  }, [activeRestaurantId, accessibleRestaurantIds, availableRestaurants]);

  useEffect(() => {
    if (selectedRestaurantId && selectedRestaurantId !== activeRestaurantId) {
      setActiveRestaurantId(selectedRestaurantId);
    }
  }, [activeRestaurantId, selectedRestaurantId, setActiveRestaurantId]);

  if (memberships.length === 0) {
    return <NoAccessState />;
  }

  if ((isLoading && availableRestaurants.length === 0) || (!restaurants && isLoading)) {
    return <LoadingState />;
  }

  if (isError || availableRestaurants.length === 0 || !selectedRestaurantId) {
    return <NoRestaurantsState />;
  }

  const selectedRestaurant =
    availableRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? availableRestaurants[0];

  const prefillName = searchParams?.get('prefillName') ?? '';
  const prefillEmail = searchParams?.get('prefillEmail') ?? '';
  const prefillPhone = searchParams?.get('prefillPhone') ?? '';

  const initialDetails = {
    restaurantId: selectedRestaurant.id,
    restaurantSlug: selectedRestaurant.slug ?? selectedRestaurant.id,
    restaurantName: selectedRestaurant.name,
    restaurantAddress: selectedRestaurant.address ?? '',
    restaurantTimezone: selectedRestaurant.timezone ?? 'UTC',
    name: prefillName,
    email: prefillEmail,
    phone: prefillPhone,
    rememberDetails: false,
    marketingOptIn: false,
    agree: true,
  } as const;

  return (
    <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">Create walk-in booking</h1>
            <p className="text-sm text-muted-foreground">
              Log a guest who arrived without a reservation. Email confirmation is sent only when an address is provided.
            </p>
          </div>
          <Button asChild variant="outline" className="touch-manipulation">
            <Link href="/">← Back to dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl">
        <BookingFlowPage key={selectedRestaurant.id} initialDetails={initialDetails} mode="ops" />
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="mx-auto w-full max-w-6xl">
        <Skeleton className="h-[480px] w-full" />
      </div>
    </main>
  );
}

function NoAccessState() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">No restaurant access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Your account is not linked to any restaurants yet.</p>
          <p>Please ask an owner or manager to add you to their team.</p>
          <Button asChild variant="secondary">
            <Link href="/">Return to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function NoRestaurantsState() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Restaurants unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>We couldn’t load your restaurant list right now. Please refresh or try again later.</p>
          <Button asChild variant="secondary">
            <Link href="/">Return to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
