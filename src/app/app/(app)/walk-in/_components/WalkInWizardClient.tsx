'use client';

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useOpsActiveMembership, useOpsSession } from "@/contexts/ops-session";
import { useOpsRestaurantDetails } from "@/hooks";
import { ReservationWizard } from "@features/reservations/wizard/ui/ReservationWizard";
import { DEFAULT_VENUE } from "@shared/config/venue";

import type { BookingDetails } from "@features/reservations/wizard/model/reducer";

export function WalkInWizardClient() {
  const router = useRouter();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantQuery = useOpsRestaurantDetails(activeRestaurantId ?? undefined);

  const initialDetails = useMemo(() => {
    if (!activeMembership || !activeRestaurantId) {
      return null;
    }

    const profile = restaurantQuery.data;
    const reservationDurationMinutes = profile?.reservationDefaultDurationMinutes;

    return {
      restaurantId: activeRestaurantId,
      restaurantSlug: activeMembership.restaurantSlug ?? DEFAULT_VENUE.slug,
      restaurantName: profile?.name ?? activeMembership.restaurantName ?? DEFAULT_VENUE.name,
      restaurantAddress: profile?.address ?? DEFAULT_VENUE.address,
      restaurantTimezone: profile?.timezone ?? DEFAULT_VENUE.timezone,
      ...(reservationDurationMinutes ? { reservationDurationMinutes } : {}),
    } satisfies Partial<BookingDetails>;
  }, [activeMembership, activeRestaurantId, restaurantQuery.data]);

  const navigator = useMemo(
    () => ({
      push: (path: string) => router.push(path),
      replace: (path: string) => router.replace(path),
      back: () => router.back(),
    }),
    [router],
  );

  if (memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Access required</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          You need a restaurant membership before logging walk-ins.
          <Button asChild size="sm" variant="secondary" className="w-fit">
            <Link href="/app/bookings">Back to bookings</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!activeMembership || !activeRestaurantId) {
    return (
      <Card className="flex min-h-[40vh] flex-col items-center justify-center gap-3 border-dashed text-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Preparing your restaurant context…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-muted/40 p-5 shadow-sm sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {activeMembership.restaurantName}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Walk-in flow
            </Badge>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">
              Log a walk-in booking
            </h1>
            <p className="text-sm text-muted-foreground sm:max-w-2xl">
              Use the same booking steps as guests, with ops controls and optional contact details. We will return you to bookings when
              you are done.
            </p>
          </div>
          {restaurantQuery.isError ? (
            <Alert variant="warning" className="max-w-xl">
              <AlertTitle>Missing restaurant details</AlertTitle>
              <AlertDescription>
                We could not load the restaurant profile. The wizard will use defaults for address and timezone.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden border shadow-sm">
        {restaurantQuery.isLoading ? (
          <div className="flex items-center gap-2 border-b border-border/70 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span role="status">Loading restaurant details…</span>
          </div>
        ) : null}
        <div className="p-3 sm:p-4 lg:p-6">
          <ReservationWizard
            mode="ops"
            initialDetails={initialDetails ?? undefined}
            returnPath="/app/bookings"
            dependencies={{ navigator }}
          />
        </div>
      </Card>
    </div>
  );
}
