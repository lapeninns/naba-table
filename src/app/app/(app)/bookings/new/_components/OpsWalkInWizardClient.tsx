'use client';

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { ReservationWizard } from "@features/reservations/wizard/ui/ReservationWizard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOpsSession } from "@/contexts/ops-session";
import { useOpsRestaurantDetails } from "@/hooks/ops/useOpsRestaurantDetails";
import { reservationConfigResult } from "@reserve/shared/config/reservations";
import { DEFAULT_VENUE } from "@shared/config/venue";

import type { BookingDetails } from "@reserve/features/reservations/wizard/model/reducer";

type ErrorStateProps = {
  onRetry?: () => void;
};

export function OpsWalkInWizardClient() {
  const router = useRouter();
  const { memberships, activeMembership } = useOpsSession();
  const restaurantId = activeMembership?.restaurantId ?? null;

  const restaurantProfile = useOpsRestaurantDetails(restaurantId);

  const navigator = useMemo(
    () => ({
      push: (path: string) => router.push(path),
      replace: (path: string) => router.replace(path),
      back: () => router.back(),
    }),
    [router],
  );

  const profile = restaurantProfile.data ?? null;
  const restaurantName = profile?.name ?? activeMembership?.restaurantName ?? DEFAULT_VENUE.name;
  const restaurantSlug = profile?.slug ?? activeMembership?.restaurantSlug ?? restaurantId ?? DEFAULT_VENUE.slug;
  const restaurantAddress = profile?.address ?? DEFAULT_VENUE.address;
  const restaurantTimezone = profile?.timezone ?? DEFAULT_VENUE.timezone;
  const reservationDuration =
    profile?.reservationDefaultDurationMinutes ?? reservationConfigResult.config.defaultDurationMinutes;

  const initialDetails = useMemo<Partial<BookingDetails>>(
    () => ({
      restaurantId: restaurantId ?? DEFAULT_VENUE.id,
      restaurantSlug: restaurantSlug ?? DEFAULT_VENUE.slug,
      restaurantName,
      restaurantAddress,
      restaurantTimezone,
      reservationDurationMinutes: reservationDuration,
      rememberDetails: false,
      marketingOptIn: false,
      agree: true,
    }),
    [restaurantAddress, restaurantId, restaurantName, restaurantSlug, restaurantTimezone, reservationDuration],
  );

  if (memberships.length === 0 || !activeMembership) {
    return <NoRestaurantAccess />;
  }

  if (!restaurantId) {
    return <MissingRestaurantState />;
  }

  if (restaurantProfile.isLoading) {
    return <LoadingState />;
  }

  if (restaurantProfile.isError) {
    return <ErrorState onRetry={() => restaurantProfile.refetch()} />;
  }

  return (
    <main id="main-content" className="space-y-6 px-3 py-6 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Walk-in booking</p>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
              Create a booking for an in-person guest
            </h1>
            <p className="text-sm text-muted-foreground sm:max-w-2xl">
              Use the same booking flow as guests to capture walk-ins with the restaurant context pre-filled.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {restaurantName}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {restaurantSlug}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button asChild variant="outline" size="sm" className="h-9 px-4">
            <Link href="/bookings">Back to bookings</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="border bg-card shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-base font-semibold text-foreground">Walk-in reservation wizard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ReservationWizard
              key={restaurantId ?? "wizard"}
              initialDetails={initialDetails}
              mode="ops"
              returnPath="/bookings"
              dependencies={{ navigator }}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="space-y-6 px-3 py-6 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="mx-auto w-full max-w-5xl">
        <Skeleton className="h-[520px] w-full" />
      </div>
    </main>
  );
}

function NoRestaurantAccess() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <Card className="w-full border-border/60 bg-muted/20">
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

function MissingRestaurantState() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
      <Alert className="w-full max-w-xl border-border/70 bg-muted/30">
        <AlertCircle className="h-4 w-4" aria-hidden />
        <AlertTitle className="text-base font-semibold text-foreground">Select a restaurant</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          We couldn’t determine which restaurant to use. Please choose a restaurant from the sidebar.
        </AlertDescription>
      </Alert>
      <Button asChild variant="secondary">
        <Link href="/bookings">Back to bookings</Link>
      </Button>
    </main>
  );
}

function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
      <Alert variant="destructive" className="w-full max-w-xl">
        <AlertCircle className="h-4 w-4" aria-hidden />
        <AlertTitle className="text-base font-semibold">Unable to load restaurant profile</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          Something went wrong while preparing the walk-in flow. Please retry.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="default" size="sm" onClick={onRetry}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Retry
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/bookings">Back to bookings</Link>
        </Button>
      </div>
    </main>
  );
}
