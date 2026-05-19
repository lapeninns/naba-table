'use client';

import { useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';

import { SettingsCard } from '../shared';
import { toBookingRulesFormValues } from './bookingRulesModel';
import { BookingRulesSubform } from '../../../../../components/ops/restaurants/RestaurantDetailsForm';

type BookingRulesCardProps = {
  restaurantId: string | null;
};

export function BookingRulesCard({ restaurantId }: BookingRulesCardProps) {
  const detailsQuery = useOpsRestaurantDetails(restaurantId);
  const [isDirty, setIsDirty] = useState(false);
  // Memoize derived form defaults so unrelated route renders do not hand the subform a fresh object.
  const initialValues = useMemo(
    () => toBookingRulesFormValues(detailsQuery.data),
    [detailsQuery.data],
  );

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
          initialValues={initialValues}
          onDirtyChange={setIsDirty}
        />
      </SettingsCard>
    </div>
  );
}
