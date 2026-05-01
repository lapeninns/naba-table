'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantDetails } from '@/hooks';
import { opsHref } from '@/lib/url/opsHref';
import { ReservationWizard } from '@features/reservations/wizard/ops';
import { inferBookingOption } from '@reserve/shared/time';
import { track, type AnalyticsEvent } from '@shared/lib/analytics';

import type { BookingDetails } from '@features/reservations/wizard/model/reducer';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_PARTY_SIZE = 2;

type SearchParamsReader = Pick<URLSearchParams, 'get'>;

function readDateParam(searchParams: SearchParamsReader): string | undefined {
  const value = searchParams.get('date')?.trim();
  return value && DATE_PATTERN.test(value) ? value : undefined;
}

function readTimeParam(searchParams: SearchParamsReader): string | undefined {
  const value = searchParams.get('time')?.trim();
  return value && TIME_PATTERN.test(value) ? value : undefined;
}

function readPartyParam(searchParams: SearchParamsReader): number {
  const partySize = Number(searchParams.get('partySize'));
  return Number.isFinite(partySize) && partySize > 0
    ? Math.min(30, Math.round(partySize))
    : DEFAULT_PARTY_SIZE;
}

export function OpsGuestBookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantQuery = useOpsRestaurantDetails(activeRestaurantId ?? undefined);
  const profile = restaurantQuery.data;

  const restaurantSlug = profile?.slug ?? activeMembership?.restaurantSlug ?? '';
  const restaurantName = profile?.name ?? activeMembership?.restaurantName ?? 'This restaurant';
  const restaurantTimezone = profile?.timezone ?? 'UTC';
  const returnPath = opsHref('/bookings');

  const initialDetails = useMemo<Partial<BookingDetails>>(() => {
    const date = readDateParam(searchParams);
    const time = readTimeParam(searchParams);
    const duration = profile?.reservationDefaultDurationMinutes;

    // Ops mode keeps the guest wizard draft shape, then useCreateOpsReservation maps it to
    // POST /api/ops/bookings: restaurantId, date, time, party, bookingType, contact, notes.
    const details: Partial<BookingDetails> = {
      restaurantId: activeRestaurantId ?? '',
      restaurantSlug,
      restaurantName,
      restaurantAddress: profile?.address ?? '',
      restaurantTimezone,
      party: readPartyParam(searchParams),
      rememberDetails: false,
      agree: false,
      marketingOptIn: false,
    };

    if (date) {
      details.date = date;
    }

    if (time) {
      details.time = time;
      details.bookingType = inferBookingOption(time, date ?? null);
    }

    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      details.reservationDurationMinutes = duration;
    }

    return details;
  }, [
    activeRestaurantId,
    profile?.address,
    profile?.reservationDefaultDurationMinutes,
    restaurantName,
    restaurantSlug,
    restaurantTimezone,
    searchParams,
  ]);

  const dependencies = useMemo(
    () => ({
      analytics: {
        track: (event: AnalyticsEvent, payload?: Record<string, unknown>) => {
          track(event, { ...payload, surface: 'ops.new-bookings' });
        },
      },
      navigator: {
        push: (path: string) => router.push(path),
        replace: (path: string) => router.replace(path),
        back: () => router.back(),
      },
    }),
    [router],
  );

  if (memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Access required</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          You need a restaurant membership before creating bookings.
          <Button asChild size="sm" variant="secondary" className="w-fit">
            <Link href={returnPath}>Back to bookings</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!activeMembership || !activeRestaurantId) {
    return (
      <Card className="flex min-h-[40vh] flex-col items-center justify-center gap-3 border-dashed text-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Preparing your restaurant context...</p>
      </Card>
    );
  }

  if (restaurantQuery.isLoading && !profile) {
    return (
      <Card className="flex min-h-[40vh] flex-col items-center justify-center gap-3 border-dashed text-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading restaurant details...</p>
      </Card>
    );
  }

  if (!restaurantSlug) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Booking link missing</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          This restaurant needs a booking slug before the standard booking flow can load
          availability.
          <Button asChild size="sm" variant="secondary" className="w-fit">
            <Link href={returnPath}>Back to bookings</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={returnPath}>
            <ArrowLeft data-icon="inline-start" aria-hidden />
            Back to bookings
          </Link>
        </Button>
      </div>
      {restaurantQuery.isError ? (
        <Alert variant="warning">
          <AlertTitle>Limited fallback mode</AlertTitle>
          <AlertDescription>
            Restaurant profile metadata could not be loaded. The wizard will use membership context
            and UTC until profile details are available.
          </AlertDescription>
        </Alert>
      ) : null}
      <ReservationWizard
        initialDetails={initialDetails}
        mode="ops"
        layoutElement="div"
        returnPath={returnPath}
        redirectOnSuccess
        dependencies={dependencies}
        className="mx-0"
        contentClassName="pb-24"
      />
    </div>
  );
}
