'use client';

import { useState } from 'react';

import { AvailabilityScheduleManager } from '@/components/features/restaurant-settings/AvailabilityScheduleManager';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import { SettingsCard } from './shared/SettingsCard';
import {
  BookingRulesSubform,
  COMMON_TIMEZONES,
  type RestaurantDetailsFormValues,
} from '../../../../components/ops/restaurants/RestaurantDetailsForm';

type AvailabilityOccasionsCommandCenterProps = {
  restaurantId: string | null;
};

const EMPTY_VALUES: RestaurantDetailsFormValues = {
  name: '',
  slug: '',
  timezone: COMMON_TIMEZONES[0],
  contactEmail: null,
  contactPhone: null,
  address: null,
  businessDescription: null,
  managerDailySummaryEnabled: false,
  managerNotificationPhone: null,
  googleMapUrl: null,
  googleReviewUrl: null,
  bookingPolicy: null,
  reservationIntervalMinutes: DEFAULT_RESERVATION_INTERVAL_MINUTES,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 15,
};

function toDetailsFormValues(
  data: ReturnType<typeof useOpsRestaurantDetails>['data'],
): RestaurantDetailsFormValues {
  if (!data) {
    return EMPTY_VALUES;
  }

  return {
    name: data.name,
    slug: data.slug ?? '',
    timezone: data.timezone ?? COMMON_TIMEZONES[0],
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    address: data.address,
    businessDescription: data.businessDescription,
    managerDailySummaryEnabled: data.managerDailySummaryEnabled,
    managerNotificationPhone: data.managerNotificationPhone,
    googleMapUrl: data.googleMapUrl,
    googleReviewUrl: data.googleReviewUrl,
    bookingPolicy: data.bookingPolicy,
    reservationIntervalMinutes: data.reservationIntervalMinutes,
    reservationDefaultDurationMinutes: data.reservationDefaultDurationMinutes,
    reservationLastSeatingBufferMinutes: data.reservationLastSeatingBufferMinutes,
    reservationLifecycleGraceMinutes: data.reservationLifecycleGraceMinutes,
  };
}

function BookingRulesCard({ restaurantId }: { restaurantId: string | null }) {
  const detailsQuery = useOpsRestaurantDetails(restaurantId);
  const [isDirty, setIsDirty] = useState(false);

  useRegisterOpsUnsavedChanges(
    'restaurant-booking-rules',
    isDirty,
    'You have unsaved booking rule changes. Leave without saving them?',
  );

  if (!restaurantId) {
    return (
      <SettingsCard
        title="Booking rules"
        description="Select a restaurant to manage reservation timing rules and booking policy."
      >
        <p className="text-sm text-muted-foreground">
          Choose a restaurant using the sidebar switcher to update booking rules.
        </p>
      </SettingsCard>
    );
  }

  if (detailsQuery.isLoading && !detailsQuery.data) {
    return (
      <SettingsCard
        title="Booking rules"
        description="Loading restaurant-level reservation timing rules."
      >
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </SettingsCard>
    );
  }

  if (detailsQuery.error) {
    return (
      <SettingsCard
        title="Booking rules"
        description="Manage reservation timing rules and booking policy."
      >
        <Alert variant="destructive">
          <AlertTitle>Unable to load booking rules</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{detailsQuery.error.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => detailsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </SettingsCard>
    );
  }

  return (
    <div id="booking-rules" className="scroll-mt-28">
      <SettingsCard
        title="Booking rules"
        description="Set the restaurant-level reservation slot rhythm, default duration, seating buffer, lifecycle grace, and guest-facing booking policy."
      >
        <BookingRulesSubform
          restaurantId={restaurantId}
          initialValues={toDetailsFormValues(detailsQuery.data)}
          onDirtyChange={setIsDirty}
        />
      </SettingsCard>
    </div>
  );
}

export function AvailabilityOccasionsCommandCenter({
  restaurantId,
}: AvailabilityOccasionsCommandCenterProps) {
  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit">
              Canonical workspace
            </Badge>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Availability & Occasions</CardTitle>
              <CardDescription className="max-w-3xl">
                Configure the restaurant&apos;s operating week, special-date overrides, meal
                windows, and bookable occasions without bouncing between separate settings pages.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="#booking-rules">Booking rules</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="#availability-schedule">Schedule</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="#booking-occasions">Occasions</a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Booking rules live here with the schedule because they affect available reservation
            times across the restaurant.
          </p>
        </CardContent>
      </Card>

      <BookingRulesCard restaurantId={restaurantId} />

      <AvailabilityScheduleManager restaurantId={restaurantId} />
    </div>
  );
}
