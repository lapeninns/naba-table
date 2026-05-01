'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useState } from 'react';

import {
  AdvancedIdentitySubform,
  BrandIdentitySubform,
  ContactLocationSubform,
  ManagerNotificationsSubform,
  type RestaurantDetailsDraftValues,
  type RestaurantDetailsFormValues,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@/hooks/ops/useOpsRestaurantDetails';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';

import { deriveProfileVerification } from './google-business-profile/googleBusinessProfileVerification';
import { RestaurantBusinessContextSection } from './RestaurantBusinessContextSection';
import { RestaurantLogoUploader } from './RestaurantLogoUploader';
import {
  PROFILE_DIRTY_SECTIONS,
  PROFILE_SECTION_FORMS,
  PROFILE_SECTION_MAP,
  QUICK_EDIT_ACTIONS,
  buildProfileValues,
  deriveReadiness,
  displayProfileValue,
  formatLastUpdated,
  getInitials,
  hasProfileValue,
  type ProfileDirtyKey,
  type ProfileDirtySection,
} from './restaurantProfileModel';
import { ProfileSectionShell } from './shared/ProfileSectionShell';
import { SettingsCard } from './shared/SettingsCard';

type RestaurantProfileSectionProps = {
  restaurantId: string | null;
};

function emitProfileEditorAnalytics(
  eventName:
    | 'restaurant_profile_editor_viewed'
    | 'restaurant_profile_edit_started'
    | 'restaurant_profile_dropoff_before_save'
    | 'restaurant_profile_common_edit_clicked'
    | 'restaurant_profile_save_all_clicked',
  props: Record<string, unknown>,
) {
  track(eventName, props);
  void emit(eventName, props);
}

function ProfileConfidencePanel({
  restaurantId,
  values,
  logoUrl,
  formDirty,
  dirtySections,
  updatedAt,
}: {
  restaurantId: string | null;
  values: RestaurantDetailsFormValues;
  logoUrl: string | null;
  formDirty: boolean;
  dirtySections: Array<{ key: string; label: string; href: string }>;
  updatedAt: string | null | undefined;
}) {
  const readiness = deriveReadiness(values, logoUrl);
  const lastSavedLabel = formatLastUpdated(updatedAt);
  const previewName = displayProfileValue(values.name, 'Restaurant name');
  const previewDescription = displayProfileValue(
    values.businessDescription,
    'Add a short description so guests know what kind of visit to expect.',
  );
  const previewContact = hasProfileValue(values.contactPhone)
    ? displayProfileValue(values.contactPhone, '')
    : displayProfileValue(values.contactEmail, 'Add a public phone or email');
  const previewAddress = displayProfileValue(values.address, 'Add the restaurant address');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Card className="border-border/70 shadow-none">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">Profile readiness</CardTitle>
              <CardDescription>
                High-impact details that help guests trust the booking page.
              </CardDescription>
            </div>
            <Badge variant={readiness.score >= 80 ? 'outline' : 'secondary'}>
              {readiness.score}% complete
            </Badge>
          </div>
          <Progress value={readiness.score} aria-label="Profile completeness score" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{readiness.completed.length} complete</span>
            <span aria-hidden="true">/</span>
            <span>{readiness.missing.length} suggested</span>
            {lastSavedLabel ? (
              <>
                <span aria-hidden="true">/</span>
                <span>Last updated {lastSavedLabel}</span>
              </>
            ) : null}
          </div>

          {readiness.missing.length > 0 ? (
            <div className="flex flex-col gap-2">
              {readiness.missing.slice(0, 4).map((item) => (
                <a
                  key={item.key}
                  href={item.sectionHref}
                  className="rounded-md bg-muted/45 px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block font-medium text-foreground">{item.label}</span>
                  <span className="block text-muted-foreground">{item.impact}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="rounded-md bg-muted/45 px-3 py-2 text-sm text-muted-foreground">
              Required and high-impact profile details are filled in.
            </p>
          )}

          <Separator />

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">Profile sections</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROFILE_SECTION_MAP.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="rounded-md bg-muted/45 px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.detail}</span>
                </a>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">Common edits</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_EDIT_ACTIONS.map((action) => {
                const Icon = action.icon;

                return (
                  <Button
                    key={action.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-auto justify-start gap-2 px-3 py-2 text-left"
                  >
                    <a
                      href={action.href}
                      onClick={() =>
                        emitProfileEditorAnalytics('restaurant_profile_common_edit_clicked', {
                          restaurant_id: restaurantId,
                          action: action.key,
                          href: action.href,
                          completeness_score: readiness.score,
                          missing_count: readiness.missing.length,
                        })
                      }
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate">{action.label}</span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {action.detail}
                        </span>
                      </span>
                    </a>
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Opening hours are managed in Availability so schedule rules stay together.
            </p>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href="/app/settings/restaurant/availability">Edit hours</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">Guest preview</CardTitle>
              <CardDescription>
                A quick look at the public details guests use to decide and arrive.
              </CardDescription>
            </div>
            <Badge variant={formDirty ? 'secondary' : 'outline'}>
              {formDirty ? 'Draft preview' : 'Saved preview'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg bg-muted/35 p-4">
            <div className="flex items-start gap-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-background shadow-sm ring-1 ring-border">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={`${previewName} logo`}
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-lg font-semibold text-muted-foreground">
                    <span aria-hidden="true">{getInitials(previewName)}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold leading-tight text-foreground">{previewName}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{previewDescription}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium text-foreground">Contact</p>
                <p className="mt-1 text-muted-foreground">{previewContact}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Arrival</p>
                <p className="mt-1 text-muted-foreground">{previewAddress}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={hasProfileValue(values.googleMapUrl) ? 'outline' : 'secondary'}>
                {hasProfileValue(values.googleMapUrl) ? 'Directions ready' : 'Add directions'}
              </Badge>
              <Badge variant={hasProfileValue(values.googleReviewUrl) ? 'outline' : 'secondary'}>
                {hasProfileValue(values.googleReviewUrl) ? 'Review link ready' : 'Add review link'}
              </Badge>
            </div>
          </div>

          {formDirty ? (
            <Alert>
              <AlertTitle>Preview includes unsaved edits</AlertTitle>
              <AlertDescription>
                Save the edited section before using this as the public source of truth.
              </AlertDescription>
            </Alert>
          ) : dirtySections.length > 0 ? null : (
            <p className="text-sm text-muted-foreground">
              This preview is based on the latest saved profile data.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
  const [sectionDrafts, setSectionDrafts] = useState<
    Partial<Record<ProfileDirtyKey, RestaurantDetailsDraftValues>>
  >({});
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null | undefined>(undefined);
  const sessionStartedAtRef = useRef(Date.now());
  const viewedRestaurantIdRef = useRef<string | null>(null);
  const editStartedEmittedRef = useRef(false);
  const dropoffEmittedRef = useRef(false);
  const dirtySectionsRef = useRef<ProfileDirtySection[]>([]);
  const formDirty = Object.values(dirtyState).some(Boolean);
  const dirtySections = useMemo(
    () => PROFILE_DIRTY_SECTIONS.filter((item) => dirtyState[item.key]),
    [dirtyState],
  );
  const dirtyFormSections = useMemo(
    () =>
      dirtySections.filter(
        (section): section is ProfileDirtySection & { formId: string } =>
          typeof section.formId === 'string',
      ),
    [dirtySections],
  );

  useRegisterOpsUnsavedChanges(
    'restaurant-profile',
    formDirty,
    'You have unsaved restaurant profile changes. Leave without saving them?',
  );

  const initialValues = useMemo<RestaurantDetailsFormValues>(() => {
    return buildProfileValues(data);
  }, [data]);
  const draftValues = useMemo<RestaurantDetailsDraftValues>(
    () =>
      (['brand', 'contact', 'notifications', 'advanced'] as const).reduce(
        (result, key) => ({ ...result, ...(sectionDrafts[key] ?? {}) }),
        {},
      ),
    [sectionDrafts],
  );
  const previewValues = useMemo<RestaurantDetailsFormValues>(
    () => ({ ...initialValues, ...draftValues }),
    [draftValues, initialValues],
  );
  const previewLogoUrl = logoPreviewUrl === undefined ? (data?.logoUrl ?? null) : logoPreviewUrl;
  const readiness = useMemo(
    () => deriveReadiness(previewValues, previewLogoUrl),
    [previewLogoUrl, previewValues],
  );

  const derivedRestaurantName = data?.name ?? initialValues.name ?? 'Restaurant';
  const profileVerification = useMemo(
    () =>
      deriveProfileVerification({
        profile: data,
        connection: gbpConnectionQuery.data,
      }),
    [data, gbpConnectionQuery.data],
  );
  const updateDirtyState = useCallback((key: ProfileDirtyKey, dirty: boolean) => {
    setDirtyState((current) => (current[key] === dirty ? current : { ...current, [key]: dirty }));
  }, []);
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
  const updateSectionDraft = useCallback(
    (key: ProfileDirtyKey, draft: RestaurantDetailsDraftValues, dirty: boolean) => {
      setSectionDrafts((current) => {
        if (!dirty) {
          if (!current[key]) {
            return current;
          }
          const next = { ...current };
          delete next[key];
          return next;
        }

        return { ...current, [key]: draft };
      });
    },
    [],
  );
  const draftHandlers = useMemo<
    Partial<Record<ProfileDirtyKey, (draft: RestaurantDetailsDraftValues, dirty: boolean) => void>>
  >(
    () => ({
      brand: (draft, dirty) => updateSectionDraft('brand', draft, dirty),
      contact: (draft, dirty) => updateSectionDraft('contact', draft, dirty),
      notifications: (draft, dirty) => updateSectionDraft('notifications', draft, dirty),
      advanced: (draft, dirty) => updateSectionDraft('advanced', draft, dirty),
    }),
    [updateSectionDraft],
  );
  const handleSaveAllProfileForms = useCallback(() => {
    emitProfileEditorAnalytics('restaurant_profile_save_all_clicked', {
      restaurant_id: restaurantId,
      dirty_section_count: dirtyFormSections.length,
      dirty_sections: dirtyFormSections.map((section) => section.key),
      completeness_score: readiness.score,
      missing_count: readiness.missing.length,
      elapsed_ms: Math.max(0, Date.now() - sessionStartedAtRef.current),
    });
    dirtyFormSections.forEach((section) => {
      const form = document.getElementById(section.formId);
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      }
    });
  }, [dirtyFormSections, readiness.missing.length, readiness.score, restaurantId]);

  useEffect(() => {
    dirtySectionsRef.current = dirtySections;
  }, [dirtySections]);

  useEffect(() => {
    if (!restaurantId || !data || viewedRestaurantIdRef.current === restaurantId) {
      return;
    }

    viewedRestaurantIdRef.current = restaurantId;
    sessionStartedAtRef.current = Date.now();
    editStartedEmittedRef.current = false;
    dropoffEmittedRef.current = false;

    emitProfileEditorAnalytics('restaurant_profile_editor_viewed', {
      restaurant_id: restaurantId,
      completeness_score: readiness.score,
      completed_count: readiness.completed.length,
      missing_count: readiness.missing.length,
      missing_fields: readiness.missing.map((item) => item.key),
    });
  }, [data, readiness.completed.length, readiness.missing, readiness.score, restaurantId]);

  useEffect(() => {
    if (!restaurantId || dirtySections.length === 0 || editStartedEmittedRef.current) {
      return;
    }

    editStartedEmittedRef.current = true;
    dropoffEmittedRef.current = false;
    emitProfileEditorAnalytics('restaurant_profile_edit_started', {
      restaurant_id: restaurantId,
      dirty_section_count: dirtySections.length,
      dirty_sections: dirtySections.map((section) => section.key),
      completeness_score: readiness.score,
      elapsed_ms: Math.max(0, Date.now() - sessionStartedAtRef.current),
    });
  }, [dirtySections, readiness.score, restaurantId]);

  useEffect(() => {
    if (!formDirty) {
      dropoffEmittedRef.current = false;
      return;
    }

    const emitDropoff = () => {
      const currentDirtySections = dirtySectionsRef.current;
      if (!restaurantId || currentDirtySections.length === 0 || dropoffEmittedRef.current) {
        return;
      }

      dropoffEmittedRef.current = true;
      emitProfileEditorAnalytics('restaurant_profile_dropoff_before_save', {
        restaurant_id: restaurantId,
        dirty_section_count: currentDirtySections.length,
        dirty_sections: currentDirtySections.map((section) => section.key),
        elapsed_ms: Math.max(0, Date.now() - sessionStartedAtRef.current),
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        emitDropoff();
      }
    };

    window.addEventListener('pagehide', emitDropoff, { passive: true });
    window.addEventListener('beforeunload', emitDropoff, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', emitDropoff);
      window.removeEventListener('beforeunload', emitDropoff);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [formDirty, restaurantId]);

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

      <ProfileConfidencePanel
        restaurantId={restaurantId}
        values={previewValues}
        logoUrl={previewLogoUrl}
        formDirty={formDirty || logoPreviewUrl !== undefined}
        dirtySections={dirtySections}
        updatedAt={data?.updatedAt}
      />

      {dirtySections.length > 0 ? (
        <Alert className="sticky bottom-4 z-20 border-primary/30 bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <AlertTitle>
            {dirtySections.length} unsaved profile section
            {dirtySections.length === 1 ? '' : 's'}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Save changed sections from this bar before leaving the page.</span>
            <div className="flex flex-wrap gap-2">
              {dirtyFormSections.length > 1 ? (
                <Button type="button" size="sm" onClick={handleSaveAllProfileForms}>
                  Save all
                </Button>
              ) : null}
              {dirtySections.map((section) =>
                section.formId ? (
                  <Button
                    key={section.key}
                    type="submit"
                    form={section.formId}
                    variant={dirtyFormSections.length > 1 ? 'outline' : 'default'}
                    size="sm"
                  >
                    {section.actionLabel}
                  </Button>
                ) : (
                  <Button key={section.key} type="button" variant="outline" size="sm" asChild>
                    <a href={section.href}>{section.actionLabel}</a>
                  </Button>
                ),
              )}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ProfileSectionShell
        id="profile-identity"
        eyebrow="1"
        title="Basic Info and Branding"
        description="Name, logo, and short public description guests should recognise first."
      >
        <RestaurantLogoUploader
          restaurantId={restaurantId}
          restaurantName={derivedRestaurantName}
          logoUrl={data?.logoUrl ?? null}
          updateMutation={updateMutation}
          isLoading={isLoading && !data}
          onPreviewChange={setLogoPreviewUrl}
        />
        <BrandIdentitySubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          formId={PROFILE_SECTION_FORMS.brand}
          onDirtyChange={dirtyHandlers.brand}
          onDraftChange={draftHandlers.brand}
          gbpFieldVerifications={profileVerification.fields}
        />
      </ProfileSectionShell>

      <ProfileSectionShell
        id="profile-contact"
        eyebrow="2"
        title="Contact and Location"
        description="Public phone, email, address, directions, and review links."
      >
        <ContactLocationSubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          formId={PROFILE_SECTION_FORMS.contact}
          onDirtyChange={dirtyHandlers.contact}
          onDraftChange={draftHandlers.contact}
          gbpFieldVerifications={profileVerification.fields}
        />
      </ProfileSectionShell>

      <ProfileSectionShell
        id="profile-operations"
        eyebrow="3"
        title="Operational Details"
        description="Daily booking summary delivery and low-frequency booking link settings."
      >
        <ManagerNotificationsSubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          formId={PROFILE_SECTION_FORMS.notifications}
          onDirtyChange={dirtyHandlers.notifications}
          onDraftChange={draftHandlers.notifications}
        />
        <AdvancedIdentitySubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          formId={PROFILE_SECTION_FORMS.advanced}
          onDirtyChange={dirtyHandlers.advanced}
          onDraftChange={draftHandlers.advanced}
        />
      </ProfileSectionShell>

      <ProfileSectionShell
        id="profile-visibility"
        eyebrow="4"
        title="Visibility"
        description="Profile basics, dining categories, amenities, service areas, and public links."
        contentClassName="gap-0"
      >
        <RestaurantBusinessContextSection
          restaurantId={restaurantId}
          embedded
          onDirtyChange={dirtyHandlers.discovery}
        />
      </ProfileSectionShell>
    </div>
  );
}
