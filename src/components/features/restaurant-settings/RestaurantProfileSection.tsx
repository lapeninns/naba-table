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
import { ProfileSectionShell } from './shared/ProfileSectionShell';
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

type ProfileDirtyKey = 'brand' | 'contact' | 'notifications' | 'discovery' | 'advanced';

export function RestaurantProfileSection({ restaurantId }: RestaurantProfileSectionProps) {
  const { data, error, isLoading, refetch } = useOpsRestaurantDetails(restaurantId);
  const gbpConnectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);
  const [dirtyState, setDirtyState] = useState<Record<ProfileDirtyKey, boolean>>({
    brand: false,
    contact: false,
    notifications: false,
    discovery: false,
    advanced: false,
  });
  const formDirty = Object.values(dirtyState).some(Boolean);
  const dirtySections = useMemo(
    () =>
      [
        { key: 'brand', label: 'Brand and identity', href: '#profile-identity' },
        { key: 'contact', label: 'Contact and location', href: '#profile-contact' },
        { key: 'notifications', label: 'Manager notifications', href: '#profile-notifications' },
        { key: 'discovery', label: 'Guest discovery', href: '#profile-discovery' },
        { key: 'advanced', label: 'Advanced link', href: '#profile-advanced' },
      ].filter((item) => dirtyState[item.key as ProfileDirtyKey]),
    [dirtyState],
  );

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
  const updateDirtyState = useCallback(
    (key: ProfileDirtyKey, dirty: boolean) => {
      setDirtyState((current) => (current[key] === dirty ? current : { ...current, [key]: dirty }));
    },
    [],
  );
  const dirtyHandlers = useMemo<Record<ProfileDirtyKey, (dirty: boolean) => void>>(
    () => ({
      // Stable handlers prevent every subform dirty-effect from rerunning on unrelated profile renders.
      brand: (dirty) => updateDirtyState('brand', dirty),
      contact: (dirty) => updateDirtyState('contact', dirty),
      notifications: (dirty) => updateDirtyState('notifications', dirty),
      discovery: (dirty) => updateDirtyState('discovery', dirty),
      advanced: (dirty) => updateDirtyState('advanced', dirty),
    }),
    [updateDirtyState],
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
      <SettingsCard title="Restaurant profile" description="Update public details and team alerts.">
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

      {dirtySections.length > 0 ? (
        <Alert className="sticky top-4 border-primary/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <AlertTitle>
            {dirtySections.length} unsaved profile section
            {dirtySections.length === 1 ? '' : 's'}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Save each section before leaving this page.</span>
            <div className="flex flex-wrap gap-2">
              {dirtySections.map((section) => (
                <Button key={section.key} type="button" variant="outline" size="sm" asChild>
                  <a href={section.href}>{section.label}</a>
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ProfileSectionShell
        id="profile-identity"
        eyebrow="1"
        title="Brand and identity"
        description="Name, logo, and short public description guests should recognise first."
      >
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
          onDirtyChange={dirtyHandlers.brand}
          gbpFieldVerifications={profileVerification.fields}
        />
      </ProfileSectionShell>

      <ProfileSectionShell
        id="profile-contact"
        eyebrow="2"
        title="Contact and location"
        description="Public phone, email, address, directions, and review links."
      >
        <ContactLocationSubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          onDirtyChange={dirtyHandlers.contact}
          gbpFieldVerifications={profileVerification.fields}
        />
      </ProfileSectionShell>

      <ProfileSectionShell
        id="profile-notifications"
        eyebrow="3"
        title="Manager notifications"
        description="Daily booking summary delivery for the management team."
      >
        <ManagerNotificationsSubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          onDirtyChange={dirtyHandlers.notifications}
        />
      </ProfileSectionShell>

      <ProfileSectionShell
        id="profile-discovery"
        eyebrow="4"
        title="Guest discovery essentials"
        description="Profile basics, dining categories, amenities, service areas, and public links."
        contentClassName="gap-0"
      >
        <RestaurantBusinessContextSection
          restaurantId={restaurantId}
          embedded
          onDirtyChange={dirtyHandlers.discovery}
        />
      </ProfileSectionShell>

      <ProfileSectionShell
        id="profile-advanced"
        eyebrow="5"
        title="Advanced"
        description="Low-frequency booking URL fields used in guest booking links."
      >
        <AdvancedIdentitySubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          onDirtyChange={dirtyHandlers.advanced}
        />
      </ProfileSectionShell>
    </div>
  );
}
