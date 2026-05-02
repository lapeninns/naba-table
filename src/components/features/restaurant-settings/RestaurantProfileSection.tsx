'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  AdvancedIdentitySubform,
  BrandIdentitySubform,
  ContactLocationSubform,
  ManagerNotificationsSubform,
  type RestaurantDetailsDraftValues,
  type RestaurantDetailsFormValues,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@/hooks/ops/useOpsRestaurantDetails';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { deriveProfileVerification } from './google-business-profile/googleBusinessProfileVerification';
import { RestaurantBusinessContextSection } from './RestaurantBusinessContextSection';
import { RestaurantLogoUploader } from './RestaurantLogoUploader';
import {
  PROFILE_DIRTY_SECTIONS,
  PROFILE_SECTION_FORMS,
  buildProfileValues,
  deriveReadiness,
  type ProfileDirtyKey,
  type ProfileDirtySection,
} from './restaurantProfileModel';
import { SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, SettingsCard } from './shared';

const PROFILE_ANCHOR_IDS = [
  'profile-identity',
  'profile-contact',
  'profile-notifications',
  'profile-discovery',
  'profile-advanced',
] as const;

type ProfileAnchorId = (typeof PROFILE_ANCHOR_IDS)[number];

const PROFILE_ANCHOR_ID_SET = new Set<string>(PROFILE_ANCHOR_IDS);

function isProfileAnchorId(value: string): value is ProfileAnchorId {
  return PROFILE_ANCHOR_ID_SET.has(value);
}

const REVIEW_GBP_HREF = opsHref('/settings/restaurant/google-business-profile');
const AVAILABILITY_BOOKING_RULES_HREF = opsHref(
  '/settings/restaurant/availability#booking-rules',
);
const TEAM_HREF = opsHref('/settings/restaurant/team');

type RestaurantProfileSectionProps = {
  restaurantId: string | null;
};

function emitProfileEditorAnalytics(
  eventName:
    | 'restaurant_profile_editor_viewed'
    | 'restaurant_profile_edit_started'
    | 'restaurant_profile_dropoff_before_save'
    | 'restaurant_profile_save_all_clicked',
  props: Record<string, unknown>,
) {
  track(eventName, props);
  void emit(eventName, props);
}

type ProfileShellProps = {
  children: React.ReactNode;
};

/**
 * Shared frame around every Profile state (loaded, loading, error, no-restaurant).
 * Owns the single header strip with the GBP CTA and the cross-link footer so the
 * page does not visually lose its chrome on restaurant switches or load states.
 */
function ProfileShell({ children }: ProfileShellProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={REVIEW_GBP_HREF}>Review Google changes</Link>
        </Button>
      </div>
      {children}
      <Alert>
        <AlertTitle>Related settings</AlertTitle>
        <AlertDescription>
          Booking rules now live with the schedule on{' '}
          <Link href={AVAILABILITY_BOOKING_RULES_HREF} className="underline">
            Availability &amp; Occasions
          </Link>
          . Manage staff invites in{' '}
          <Link href={TEAM_HREF} className="underline">
            Team
          </Link>
          .
        </AlertDescription>
      </Alert>
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

  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.slice(1);
      if (!raw || !isProfileAnchorId(raw)) {
        return;
      }
      requestAnimationFrame(() => {
        document.getElementById(raw)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

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
      <ProfileShell>
        <SettingsCard
          title="Select a restaurant"
          description="Pick a restaurant from the sidebar switcher to manage what guests and staff see."
        >
          <p className="text-sm text-muted-foreground">
            Choose a restaurant using the sidebar switcher to update its public details and team
            alerts.
          </p>
        </SettingsCard>
      </ProfileShell>
    );
  }

  if (isLoading && !data) {
    return (
      <ProfileShell>
        <SettingsCard
          title="Loading restaurant profile"
          description="Loading the restaurant details staff use day to day."
        >
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        </SettingsCard>
      </ProfileShell>
    );
  }

  if (error) {
    return (
      <ProfileShell>
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
      </ProfileShell>
    );
  }

  return (
    <ProfileShell>
      {dirtySections.length > 0 ? (
        <Alert
          className={cn(SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, 'border-primary/30 shadow-lg')}
        >
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
                    <Link href={section.href}>{section.actionLabel}</Link>
                  </Button>
                ),
              )}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div id="profile-identity" className="scroll-mt-24">
        <SettingsCard
          title="Brand and identity"
          description="Logo, name, and short public description guests should recognise first."
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
        </SettingsCard>
      </div>

      <div id="profile-contact" className="scroll-mt-24">
        <SettingsCard
          title="Contact and location"
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
        </SettingsCard>
      </div>

      <div id="profile-notifications" className="scroll-mt-24">
        <SettingsCard
          title="Manager notifications"
          description="Daily booking summary delivery for the restaurant manager."
        >
          <ManagerNotificationsSubform
            restaurantId={restaurantId}
            initialValues={initialValues}
            formId={PROFILE_SECTION_FORMS.notifications}
            onDirtyChange={dirtyHandlers.notifications}
            onDraftChange={draftHandlers.notifications}
          />
        </SettingsCard>
      </div>

      <div id="profile-discovery" className="scroll-mt-24">
        <SettingsCard
          title="Discovery details"
          description="Profile basics, dining categories, amenities, service areas, and public links guests use to find this venue."
          contentClassName="gap-0"
        >
          <RestaurantBusinessContextSection
            restaurantId={restaurantId}
            embedded
            onDirtyChange={dirtyHandlers.discovery}
          />
        </SettingsCard>
      </div>

      <div id="profile-advanced" className="scroll-mt-24">
        <SettingsCard
          title="Advanced"
          description="Booking-link slug used in the guest-facing reservation URL."
        >
          <AdvancedIdentitySubform
            restaurantId={restaurantId}
            initialValues={initialValues}
            formId={PROFILE_SECTION_FORMS.advanced}
            onDirtyChange={dirtyHandlers.advanced}
            onDraftChange={draftHandlers.advanced}
          />
        </SettingsCard>
      </div>
    </ProfileShell>
  );
}
