'use client';

import { useMemo } from 'react';
import { toast } from 'react-hot-toast';

import {
  RestaurantDetailsForm,
  type RestaurantDetailsFormValues,
  COMMON_TIMEZONES,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import type { UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsRestaurantDetails, useOpsUpdateRestaurantDetails } from '@/hooks';

import { RestaurantLogoUploader } from './RestaurantLogoUploader';

const EMPTY_VALUES: RestaurantDetailsFormValues = {
  name: '',
  slug: '',
  timezone: COMMON_TIMEZONES[0],
  contactEmail: null,
  contactPhone: null,
  address: null,
  bookingPolicy: null,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
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
      bookingPolicy: data.bookingPolicy,
      reservationIntervalMinutes: data.reservationIntervalMinutes,
      reservationDefaultDurationMinutes: data.reservationDefaultDurationMinutes,
      reservationLastSeatingBufferMinutes: data.reservationLastSeatingBufferMinutes,
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
        bookingPolicy: values.bookingPolicy ?? null,
        reservationIntervalMinutes: values.reservationIntervalMinutes,
        reservationDefaultDurationMinutes: values.reservationDefaultDurationMinutes,
        reservationLastSeatingBufferMinutes: values.reservationLastSeatingBufferMinutes,
      });
      toast.success('Restaurant details updated');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to update restaurant';
      toast.error(message);
    }
  };

  if (!restaurantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Profile</CardTitle>
          <CardDescription>Select a restaurant to manage its profile details.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Choose a restaurant using the sidebar switcher to view and update its name, slug, contact information, and booking policy.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Profile</CardTitle>
          <CardDescription>Update core details, contact information, and booking policy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Profile</CardTitle>
          <CardDescription>Update core details, contact information, and booking policy.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Unable to load restaurant details</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error.message}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restaurant Profile</CardTitle>
        <CardDescription>Update core restaurant details and contact information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
      </CardContent>
    </Card>
  );
}
