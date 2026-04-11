'use client';

import { useMemo } from 'react';

import {
  RestaurantDetailsForm,
  type RestaurantDetailsFormValues,
  COMMON_TIMEZONES,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@/hooks/ops/useOpsRestaurantDetails';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import { RestaurantLogoUploader } from './RestaurantLogoUploader';
import { SettingsCard } from './shared/SettingsCard';

import type { UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';

const EMPTY_VALUES: RestaurantDetailsFormValues = {
  name: '',
  slug: '',
  timezone: COMMON_TIMEZONES[0],
  contactEmail: null,
  contactPhone: null,
  address: null,
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

type RestaurantProfileSectionProps = {
  restaurantId: string | null;
};

export function RestaurantProfileSection({ restaurantId }: RestaurantProfileSectionProps) {
  const { data, error, isLoading, refetch } = useOpsRestaurantDetails(restaurantId);
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);

  const initialValues = useMemo<RestaurantDetailsFormValues>(() => {
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
  }, [data]);

  const derivedRestaurantName = data?.name ?? initialValues.name ?? 'Restaurant';

  const handleSubmit = async (values: UpdateRestaurantInput) => {
    try {
      await updateMutation.mutateAsync({
        name: values.name,
        slug: values.slug,
        timezone: values.timezone,
        contactEmail: values.contactEmail ?? null,
        contactPhone: values.contactPhone ?? null,
        address: values.address ?? null,
        managerDailySummaryEnabled: values.managerDailySummaryEnabled,
        managerNotificationPhone: values.managerNotificationPhone ?? null,
        googleMapUrl: values.googleMapUrl ?? null,
        googleReviewUrl: values.googleReviewUrl ?? null,
        bookingPolicy: values.bookingPolicy ?? null,
        reservationIntervalMinutes: values.reservationIntervalMinutes,
        reservationDefaultDurationMinutes: values.reservationDefaultDurationMinutes,
        reservationLastSeatingBufferMinutes: values.reservationLastSeatingBufferMinutes,
        reservationLifecycleGraceMinutes: values.reservationLifecycleGraceMinutes,
      });
    } catch (submitError) {
      console.error('[restaurant-profile] update failed', submitError);
    }
  };

  if (!restaurantId) {
    return (
      <SettingsCard
        title="Restaurant Profile"
        description="Select a restaurant to manage its profile details."
      >
        <p className="text-sm text-muted-foreground">
          Choose a restaurant using the sidebar switcher to view and update its name, slug, contact
          information, and booking policy.
        </p>
      </SettingsCard>
    );
  }

  if (isLoading && !data) {
    return (
      <SettingsCard
        title="Restaurant Profile"
        description="Update core details, contact information, and booking policy."
      >
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </SettingsCard>
    );
  }

  if (error) {
    return (
      <SettingsCard
        title="Restaurant Profile"
        description="Update core details, contact information, and booking policy."
      >
        <Alert variant="destructive">
          <AlertTitle>Unable to load restaurant details</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Restaurant Profile"
      description="Update core restaurant details and contact information."
    >
      <div className="space-y-6">
        <RestaurantLogoUploader
          restaurantId={restaurantId}
          restaurantName={derivedRestaurantName}
          logoUrl={data?.logoUrl ?? null}
          updateMutation={updateMutation}
          isLoading={isLoading && !data}
        />
        <RestaurantDetailsForm
          initialValues={initialValues}
          onSubmit={handleSubmit}
          isSubmitting={updateMutation.isPending}
        />
      </div>
    </SettingsCard>
  );
}
