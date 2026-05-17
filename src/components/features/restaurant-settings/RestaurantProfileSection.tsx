'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

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

import { useOptionalGbpDrift } from './gbp-drift/useGbpDrift';
import { useGbpDriftSectionStatus, useGbpDriftStatus } from './GbpDriftProvider';
import { deriveProfileVerification } from './google-business-profile/googleBusinessProfileVerification';
import {
  PROFILE_SECTION_DEFINITIONS,
  ProfileSectionPane,
  ProfileStatusBar,
  UnifiedActionBar,
  findProfileSection,
  type ProfileSectionId,
} from './profile';
import { RestaurantBusinessContextSection } from './RestaurantBusinessContextSection';
import { RestaurantLogoUploader } from './RestaurantLogoUploader';
import {
  PROFILE_DIRTY_SECTIONS,
  PROFILE_SECTION_FORMS,
  buildProfileValues,
  deriveReadiness,
  type ReadinessItemKey,
  type ProfileDirtyKey,
  type ProfileDirtySection,
} from './restaurantProfileModel';
import {
  SettingsCard,
  SettingsSectionNav,
  SETTINGS_COMMAND_CENTER_LAYOUT_CLASS,
  type RestaurantSettingsCommandRailItem,
} from './shared';

const PROFILE_ANCHOR_IDS = [
  'profile-identity',
  'profile-contact',
  'profile-booking-url',
  'profile-notifications',
  'profile-discovery',
] as const;

type ProfileAnchorId = (typeof PROFILE_ANCHOR_IDS)[number];

const PROFILE_ANCHOR_ID_SET = new Set<string>(PROFILE_ANCHOR_IDS);

function isProfileAnchorId(value: string): value is ProfileAnchorId {
  return PROFILE_ANCHOR_ID_SET.has(value);
}

const REVIEW_GBP_HREF = opsHref('/settings/restaurant/google-business-profile');
const DEFAULT_ACTIVE_SECTION_ID: ProfileSectionId = 'brand';

const READINESS_FIELD_TARGETS: Partial<
  Record<ReadinessItemKey, { sectionId: ProfileSectionId; fieldId: string }>
> = {
  name: { sectionId: 'brand', fieldId: 'restaurant-name' },
  description: { sectionId: 'brand', fieldId: 'restaurant-business-description' },
  bookingUrl: { sectionId: 'advanced', fieldId: 'restaurant-slug' },
  contactPhone: { sectionId: 'contact', fieldId: 'restaurant-phone' },
  contactEmail: { sectionId: 'contact', fieldId: 'restaurant-email' },
  address: { sectionId: 'contact', fieldId: 'restaurant-address' },
  timezone: { sectionId: 'contact', fieldId: 'restaurant-timezone' },
  mapUrl: { sectionId: 'contact', fieldId: 'restaurant-google-map' },
  logo: { sectionId: 'brand', fieldId: 'restaurant-logo-uploader' },
};

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
  railItems?: RestaurantSettingsCommandRailItem[];
  children: ReactNode;
};

/**
 * Shared compact frame around every Profile state (loaded, loading,
 * error, no-restaurant). Keeps editing directly under the page heading.
 */
function ProfileShell({ railItems, children }: ProfileShellProps) {
  return (
    <section className={SETTINGS_COMMAND_CENTER_LAYOUT_CLASS} aria-label="Profile sections">
      <SettingsSectionNav title="Profile sections" showHeader={false} items={railItems} />
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

export function RestaurantProfileSection({ restaurantId }: RestaurantProfileSectionProps) {
  const { data, error, isLoading, refetch } = useOpsRestaurantDetails(restaurantId);
  const gbpConnectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const { status: gbpStatus } = useGbpDriftStatus();
  const gbpDrift = useOptionalGbpDrift();
  const registerGbpDraftOverride = gbpDrift?.registerDraftOverride;
  const clearGbpDraftOverrides = gbpDrift?.clearDraftOverrides;
  const profileDriftStatus = useGbpDriftSectionStatus([
    'profile',
    'businessContext.categories',
    'businessContext.serviceAreas',
    'businessContext.attributes',
    'businessContext.serviceItems',
  ]);
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);
  const [dirtyState, setDirtyState] = useState<Record<ProfileDirtyKey, boolean>>({
    brand: false,
    contact: false,
    notifications: false,
    discovery: false,
    advanced: false,
  });
  const [activeSectionId, setActiveSectionId] =
    useState<ProfileSectionId>(DEFAULT_ACTIVE_SECTION_ID);
  const [sectionDrafts, setSectionDrafts] = useState<
    Partial<Record<ProfileDirtyKey, RestaurantDetailsDraftValues>>
  >({});
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null | undefined>(undefined);
  const sessionStartedAtRef = useRef(Date.now());
  const viewedRestaurantIdRef = useRef<string | null>(null);
  const editStartedEmittedRef = useRef(false);
  const dropoffEmittedRef = useRef(false);
  const dirtySectionsRef = useRef<ProfileDirtySection[]>([]);
  const resetDraftHandlersRef = useRef<Partial<Record<ProfileDirtyKey, () => void>>>({});
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
      const section = PROFILE_SECTION_DEFINITIONS.find((item) => item.anchorId === raw);
      if (section) {
        setActiveSectionId(section.id);
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
  useEffect(() => {
    if (!registerGbpDraftOverride) return;
    registerGbpDraftOverride('profile.name', previewValues.name);
    registerGbpDraftOverride('profile.businessDescription', previewValues.businessDescription);
    registerGbpDraftOverride('profile.contactPhone', previewValues.contactPhone);
    registerGbpDraftOverride('profile.address', previewValues.address);
    registerGbpDraftOverride('profile.googleMapUrl', previewValues.googleMapUrl);
    registerGbpDraftOverride('profile.googleReviewUrl', previewValues.googleReviewUrl);
    return () => {
      clearGbpDraftOverrides?.([
        'profile.name',
        'profile.businessDescription',
        'profile.contactPhone',
        'profile.address',
        'profile.googleMapUrl',
        'profile.googleReviewUrl',
      ]);
    };
  }, [
    clearGbpDraftOverrides,
    previewValues.address,
    previewValues.businessDescription,
    previewValues.contactPhone,
    previewValues.googleMapUrl,
    previewValues.googleReviewUrl,
    previewValues.name,
    registerGbpDraftOverride,
  ]);
  const readiness = useMemo(
    () => deriveReadiness(previewValues, previewLogoUrl),
    [previewLogoUrl, previewValues],
  );
  const missingRequiredSectionIds = useMemo(() => {
    const ids = new Set<ProfileSectionId>();
    readiness.missingRequired.forEach((item) => {
      const section = PROFILE_SECTION_DEFINITIONS.find(
        (definition) => item.href === `#${definition.anchorId}`,
      );
      if (section) {
        ids.add(section.id);
      }
    });
    return ids;
  }, [readiness.missingRequired]);
  const readinessStageLabel =
    readiness.score >= 90
      ? 'Launch-ready'
      : readiness.score >= 70
        ? 'Almost ready'
        : readiness.score >= 40
          ? 'In progress'
          : 'Needs setup';
  const nextReadinessItem = readiness.missingRequired[0] ?? null;

  const derivedRestaurantName = previewValues.name.trim() || data?.name || 'Restaurant';
  const profileVerification = useMemo(
    () =>
      deriveProfileVerification({
        profile: data,
        connection: gbpConnectionQuery.data,
      }),
    [data, gbpConnectionQuery.data],
  );
  const googleDifferenceCount = Object.values(profileVerification.fields).filter(
    (field) => field.status === 'drifted',
  ).length;
  const hasGbpDriftContext = gbpStatus.kind !== 'no_profile' && gbpStatus.kind !== 'unknown';
  const liveProfileReviewCount = gbpDrift
    ? gbpDrift.driftCountBySection.profile +
      gbpDrift.driftCountBySection['businessContext.categories'] +
      gbpDrift.driftCountBySection['businessContext.serviceAreas'] +
      gbpDrift.driftCountBySection['businessContext.attributes'] +
      gbpDrift.driftCountBySection['businessContext.serviceItems']
    : 0;
  const profileReviewCount = Math.max(
    googleDifferenceCount,
    profileDriftStatus.needsReviewCount,
    liveProfileReviewCount,
  );
  const isGoogleLinked = gbpConnectionQuery.data?.status === 'linked' || gbpDrift?.isLinked;
  const handleCompareProfileWithGoogle = useCallback(() => {
    gbpDrift?.openCompare({
      sectionKeys: [
        'profile',
        'businessContext.categories',
        'businessContext.serviceAreas',
        'businessContext.attributes',
        'businessContext.serviceItems',
      ],
      filter: profileReviewCount > 0 ? 'drifted_only' : 'all',
    });
  }, [gbpDrift, profileReviewCount]);
  const googleStatusDetail =
    hasGbpDriftContext && gbpStatus.kind === 'connected_with_review' && profileReviewCount > 0
      ? 'Review profile and discovery drift in the Google workspace before importing or exporting.'
      : gbpConnectionQuery.data?.status === 'linked'
        ? googleDifferenceCount > 0
          ? 'Review differences before importing so guest-facing details stay intentional.'
          : 'Google fields match this profile snapshot.'
        : hasGbpDriftContext && gbpStatus.kind === 'connected_outdated'
          ? gbpStatus.detail
          : 'Link Google only when you need import or side-by-side comparison.';
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
  const registerResetDraftHandler = useCallback(
    (key: ProfileDirtyKey, resetDraft: (() => void) | null) => {
      if (!resetDraft) {
        delete resetDraftHandlersRef.current[key];
        return;
      }
      resetDraftHandlersRef.current[key] = resetDraft;
    },
    [],
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
  const handleCancelActiveSection = useCallback(() => {
    const section = findProfileSection(activeSectionId);
    resetDraftHandlersRef.current[section.dirtyKey]?.();
  }, [activeSectionId]);
  const handleSelectProfileSection = useCallback((sectionId: ProfileSectionId) => {
    const section = findProfileSection(sectionId);
    setActiveSectionId(sectionId);
    window.history.replaceState(null, '', `#${section.anchorId}`);
    requestAnimationFrame(() => {
      document.getElementById(section.anchorId)?.scrollIntoView({ block: 'start' });
    });
  }, []);
  const handleFocusReadinessItem = useCallback((key: ReadinessItemKey) => {
    const target = READINESS_FIELD_TARGETS[key];
    if (!target) {
      return;
    }

    const section = findProfileSection(target.sectionId);
    setActiveSectionId(target.sectionId);
    window.history.replaceState(null, '', `#${section.anchorId}`);
    requestAnimationFrame(() => {
      const field = document.getElementById(target.fieldId);
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (field instanceof HTMLElement) {
        field.focus({ preventScroll: true });
        if (typeof field.animate === 'function') {
          field.animate(
            [
              { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' },
              { boxShadow: '0 0 0 4px hsl(var(--primary) / 0.24)' },
              { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' },
            ],
            { duration: 900, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
          );
        }
      }
    });
  }, []);

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

  const discoveryDirty = dirtyState.discovery;
  const activeSection = findProfileSection(activeSectionId);
  const railItems: RestaurantSettingsCommandRailItem[] = PROFILE_SECTION_DEFINITIONS.map(
    (section) => {
      const isDirty = dirtyState[section.dirtyKey];
      const isMissingRequired = missingRequiredSectionIds.has(section.id);
      return {
        label: section.setupStep ? `${section.setupStep} · ${section.navLabel}` : section.navLabel,
        isActive: section.id === activeSectionId,
        onSelect: () => handleSelectProfileSection(section.id),
        Icon: section.icon,
        badge: isDirty ? 'Draft' : isMissingRequired ? 'Required' : undefined,
      };
    },
  );

  return (
    <ProfileShell railItems={railItems}>
      <div className="flex flex-col gap-4">
        <ProfileStatusBar
          bookingSlug={previewValues.slug || null}
          readinessScore={readiness.score}
          readinessStageLabel={readinessStageLabel}
          completedCount={readiness.completed.length}
          totalCount={readiness.missing.length + readiness.completed.length}
          requiredRemainingCount={readiness.missingRequired.length}
          googleHint={isGoogleLinked ? null : googleStatusDetail}
          googleHref={`${REVIEW_GBP_HREF}#gbp-connection`}
          nextActionLabel={nextReadinessItem ? `Fix ${nextReadinessItem.label}` : null}
          nextActionDescription={
            nextReadinessItem
              ? 'Complete the next required item to make the booking link reliable for guests.'
              : 'Required profile fields are complete. You can now polish discovery details.'
          }
          onJumpToBooking={() => handleFocusReadinessItem('bookingUrl')}
          onJumpToNextAction={
            nextReadinessItem ? () => handleFocusReadinessItem(nextReadinessItem.key) : null
          }
        />

        {PROFILE_SECTION_DEFINITIONS.map((section) => (
          <ProfileSectionPane
            key={section.id}
            section={section}
            isActive={section.id === activeSectionId}
            isDirty={dirtyState[section.dirtyKey]}
            isMissingRequired={missingRequiredSectionIds.has(section.id)}
          >
            {section.id === 'brand' ? (
              <>
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
                  actionPlacement="stickyBar"
                  onDirtyChange={dirtyHandlers.brand}
                  onDraftChange={draftHandlers.brand}
                  onResetDraftChange={(resetDraft) =>
                    registerResetDraftHandler('brand', resetDraft)
                  }
                  gbpFieldVerifications={profileVerification.fields}
                />
              </>
            ) : null}
            {section.id === 'contact' ? (
              <ContactLocationSubform
                restaurantId={restaurantId}
                initialValues={initialValues}
                formId={PROFILE_SECTION_FORMS.contact}
                actionPlacement="stickyBar"
                onDirtyChange={dirtyHandlers.contact}
                onDraftChange={draftHandlers.contact}
                onResetDraftChange={(resetDraft) =>
                  registerResetDraftHandler('contact', resetDraft)
                }
                gbpFieldVerifications={profileVerification.fields}
              />
            ) : null}
            {section.id === 'advanced' ? (
              <AdvancedIdentitySubform
                restaurantId={restaurantId}
                initialValues={initialValues}
                formId={PROFILE_SECTION_FORMS.advanced}
                actionPlacement="stickyBar"
                onDirtyChange={dirtyHandlers.advanced}
                onDraftChange={draftHandlers.advanced}
                onResetDraftChange={(resetDraft) =>
                  registerResetDraftHandler('advanced', resetDraft)
                }
              />
            ) : null}
            {section.id === 'notifications' ? (
              <ManagerNotificationsSubform
                restaurantId={restaurantId}
                initialValues={initialValues}
                formId={PROFILE_SECTION_FORMS.notifications}
                actionPlacement="stickyBar"
                onDirtyChange={dirtyHandlers.notifications}
                onDraftChange={draftHandlers.notifications}
                onResetDraftChange={(resetDraft) =>
                  registerResetDraftHandler('notifications', resetDraft)
                }
              />
            ) : null}
            {section.id === 'discovery' ? (
              <RestaurantBusinessContextSection
                restaurantId={restaurantId}
                embedded
                onDirtyChange={dirtyHandlers.discovery}
              />
            ) : null}
          </ProfileSectionPane>
        ))}

        <UnifiedActionBar
          dirtyFormSections={dirtyFormSections}
          discoveryDirty={discoveryDirty}
          activeSection={activeSection}
          lastSavedAt={data?.updatedAt ?? null}
          onSaveAll={handleSaveAllProfileForms}
          onCancelActive={handleCancelActiveSection}
          gbpDriftCount={profileReviewCount}
          onCompareWithGoogle={gbpDrift?.isLinked ? handleCompareProfileWithGoogle : undefined}
        />
      </div>
    </ProfileShell>
  );
}
