'use client';

import { Settings2 } from 'lucide-react';
import { useMemo } from 'react';
import { useState } from 'react';

import {
  RestaurantDetailsForm,
  type RestaurantDetailsFormValues,
  COMMON_TIMEZONES,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@/hooks/ops/useOpsRestaurantDetails';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import { deriveProfileVerification } from './google-business-profile/googleBusinessProfileVerification';
import { RestaurantBusinessContextSection } from './RestaurantBusinessContextSection';
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
  const gbpConnectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);
  const [formDirty, setFormDirty] = useState(false);

  useRegisterOpsUnsavedChanges(
    'restaurant-profile',
    formDirty,
    'You have unsaved restaurant profile changes. Leave without saving them?',
  );

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
  const profileVerification = useMemo(
    () =>
      deriveProfileVerification({
        profile: data,
        connection: gbpConnectionQuery.data,
      }),
    [data, gbpConnectionQuery.data],
  );
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
    <div className="space-y-6">
      <SettingsCard
        title="Restaurant Profile"
        description="Update core restaurant details and contact information."
        headerAction={
          <Button type="button" variant="outline" asChild>
            <a href="/app/settings/restaurant/google-business-profile">Review GBP draft</a>
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">{profileVerification.summary}</p>
            {profileVerification.warnings.map((warning) => (
              <p key={warning} className="text-xs text-muted-foreground">
                {warning}
              </p>
            ))}
          </div>
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
            onDirtyChange={setFormDirty}
            gbpFieldVerifications={profileVerification.fields}
          />
        </div>
      </SettingsCard>

      <div id="profile-advanced" className="scroll-mt-28">
        <SettingsCard
          title="Advanced"
          description="Low-frequency structured metadata and specialist setup for discovery, integrations, and future sync-aware flows."
        >
          <Accordion
            type="single"
            collapsible
            className="rounded-xl border border-border/60 bg-muted/10"
          >
            <AccordionItem value="business-context" className="border-none">
              <AccordionTrigger className="rounded-xl px-4 py-4 hover:bg-muted/30">
                <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <div className="rounded-lg border border-border/60 bg-background p-2">
                    <Settings2 className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Business Context
                      </span>
                      <Badge variant="outline" className="text-[11px] uppercase tracking-[0.16em]">
                        Advanced
                      </Badge>
                    </div>
                    <p className="text-sm font-normal leading-6 text-muted-foreground">
                      Categories, service areas, attributes, and service items that shape structured
                      restaurant metadata.
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <RestaurantBusinessContextSection restaurantId={restaurantId} embedded />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SettingsCard>
      </div>
    </div>
  );
}
