'use client';

import { useCallback, useMemo } from 'react';
import { useState } from 'react';

import {
  AdvancedIdentitySubform,
  BrandIdentitySubform,
  ContactLocationSubform,
  COMMON_TIMEZONES,
  ManagerNotificationsSubform,
  type RestaurantDetailsFormValues,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

type RestaurantProfileSectionProps = {
  restaurantId: string | null;
};

type ProfileDirtyKey = 'brand' | 'contact' | 'notifications' | 'advanced';

export function RestaurantProfileSection({ restaurantId }: RestaurantProfileSectionProps) {
  const { data, error, isLoading, refetch } = useOpsRestaurantDetails(restaurantId);
  const gbpConnectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);
  const [dirtyState, setDirtyState] = useState<Record<ProfileDirtyKey, boolean>>({
    brand: false,
    contact: false,
    notifications: false,
    advanced: false,
  });
  const formDirty = Object.values(dirtyState).some(Boolean);

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
  const setSubformDirty = useCallback(
    (key: ProfileDirtyKey) => (dirty: boolean) => {
      setDirtyState((current) => (current[key] === dirty ? current : { ...current, [key]: dirty }));
    },
    [],
  );

  if (!restaurantId) {
    return (
      <SettingsCard
        title="Restaurant profile"
        description="Select a restaurant to manage what guests and staff see."
      >
        <p className="text-sm text-muted-foreground">
          Choose a restaurant using the sidebar switcher to update its public details and team
          alerts.
        </p>
      </SettingsCard>
    );
  }

  if (isLoading && !data) {
    return (
      <SettingsCard
        title="Restaurant profile"
        description="Loading the restaurant details staff use day to day."
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
        title="Restaurant profile"
        description="Update public details and team alerts."
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
    <div className="flex flex-col gap-6">
      <Card className="border-border/70">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
          <div className="flex flex-col gap-2">
            <Badge
              variant={profileVerification.warnings.length > 0 ? 'secondary' : 'outline'}
              className="w-fit"
            >
              {profileVerification.summary}
            </Badge>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-2xl">Restaurant profile</CardTitle>
              <CardDescription className="max-w-3xl">
                Keep guest-facing details, team alerts, and public discovery information in one
                place.
              </CardDescription>
            </div>
          </div>
          <Button type="button" variant="outline" asChild>
            <a href="/app/settings/restaurant/google-business-profile">Review Google changes</a>
          </Button>
        </CardHeader>
      </Card>

      <div id="profile-identity" className="scroll-mt-28">
        <SettingsCard
          title="Brand and public description"
          description="Set the name, logo, and short description guests should recognise."
        >
          <div className="flex flex-col gap-6">
            <RestaurantLogoUploader
              restaurantId={restaurantId}
              restaurantName={derivedRestaurantName}
              logoUrl={data?.logoUrl ?? null}
              updateMutation={updateMutation}
              isLoading={isLoading && !data}
            />
            <BrandIdentitySubform
              restaurantId={restaurantId}
              initialValues={initialValues}
              onDirtyChange={setSubformDirty('brand')}
              gbpFieldVerifications={profileVerification.fields}
            />
          </div>
        </SettingsCard>
      </div>

      <SettingsCard
        title="Contact and location"
        description="Keep the public phone, email, address, directions, and review links current."
      >
        <ContactLocationSubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          onDirtyChange={setSubformDirty('contact')}
          gbpFieldVerifications={profileVerification.fields}
        />
      </SettingsCard>

      <div id="profile-notifications" className="scroll-mt-28">
        <SettingsCard
          title="Daily manager summary"
          description="Choose where the daily booking summary SMS should go."
        >
          <ManagerNotificationsSubform
            restaurantId={restaurantId}
            initialValues={initialValues}
            onDirtyChange={setSubformDirty('notifications')}
          />
        </SettingsCard>
      </div>

      <div id="profile-discovery" className="scroll-mt-28">
        <SettingsCard
          title="Guest discovery essentials"
          description="Set the profile basics, dining categories, and public links guests use when discovering this restaurant."
        >
          <RestaurantBusinessContextSection restaurantId={restaurantId} embedded />
        </SettingsCard>
      </div>

      <div id="profile-advanced" className="scroll-mt-28">
        <SettingsCard
          title="Booking link"
          description="Edit the short link used in guest booking URLs."
        >
          <AdvancedIdentitySubform
            restaurantId={restaurantId}
            initialValues={initialValues}
            onDirtyChange={setSubformDirty('advanced')}
          />
        </SettingsCard>
      </div>
    </div>
  );
}
