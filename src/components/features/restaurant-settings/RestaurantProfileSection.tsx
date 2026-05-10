'use client';

import { ArrowRight, Compass } from 'lucide-react';
import Link from 'next/link';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { useOpsRestaurantBusinessContext } from '@/hooks/ops/useOpsRestaurantBusinessContext';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@/hooks/ops/useOpsRestaurantDetails';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { deriveProfileVerification } from './google-business-profile/googleBusinessProfileVerification';
import {
  DiscoverySheet,
  PROFILE_DISCOVERY_DEFINITION,
  PROFILE_SECTION_DEFINITIONS,
  ProfileOverviewCard,
  ProfileSectionPane,
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
const AVAILABILITY_BOOKING_RULES_HREF = opsHref('/settings/restaurant/availability#booking-rules');
const TEAM_HREF = opsHref('/settings/restaurant/team');
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

const PROFILE_FOOTER = (
  <span>
    Booking rules now live with the schedule on{' '}
    <Link href={AVAILABILITY_BOOKING_RULES_HREF} className="underline">
      Availability &amp; Booking types
    </Link>
    . Manage staff invites in{' '}
    <Link href={TEAM_HREF} className="underline">
      Team
    </Link>
    . Google is optional and only needed when you want import or comparison support.
  </span>
);

type ProfileShellProps = {
  railItems?: RestaurantSettingsCommandRailItem[];
  children: ReactNode;
};

/**
 * Shared command-center frame around every Profile state (loaded, loading,
 * error, no-restaurant). Keeps the same restaurant-settings layout contract as
 * the Availability route so editing starts directly under the header.
 */
function ProfileShell({
  railItems,
  children,
}: ProfileShellProps) {
  const hasRail = (railItems?.length ?? 0) > 0;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      {hasRail ? (
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="gap-1 px-4 py-3">
              <CardTitle className="text-base">Profile sections</CardTitle>
              <CardDescription className="text-xs leading-5">
                Required items make the booking link usable. Discovery stays optional and saves in
                its own drawer.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 px-2 pb-3">
              {(railItems ?? []).map((item) => {
                const Icon = item.Icon;
                const itemKey = item.href ?? item.label;
                const content = (
                  <>
                    {Icon ? (
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
                        <Icon className="size-4" aria-hidden />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium leading-5">
                        {item.label}
                        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                      </span>
                      {item.description ? (
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground break-words">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    {item.badge ? (
                      <span className="shrink-0 rounded-md border border-border/70 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.badge}
                      </span>
                    ) : null}
                  </>
                );

                if (item.onSelect) {
                  return (
                    <Button
                      key={itemKey}
                      type="button"
                      variant="ghost"
                      aria-current={item.isActive ? 'page' : undefined}
                      onClick={item.onSelect}
                      className={cn(
                        'h-auto items-start justify-start gap-3 whitespace-normal px-2 py-2 text-left',
                        item.isActive && 'bg-primary/10 text-foreground',
                      )}
                    >
                      {content}
                    </Button>
                  );
                }

                return (
                  <Button
                    key={itemKey}
                    asChild
                    variant="ghost"
                    aria-current={item.isActive ? 'page' : undefined}
                    className={cn(
                      'h-auto items-start justify-start gap-3 whitespace-normal px-2 py-2 text-left',
                      item.isActive && 'bg-primary/10 text-foreground',
                    )}
                  >
                    <Link href={item.href ?? '#'}>{content}</Link>
                  </Button>
                );
              })}
            </CardContent>
            <Separator />
            <div className="px-4 py-3 text-xs leading-5 text-muted-foreground">{PROFILE_FOOTER}</div>
          </Card>
        </aside>
      ) : null}
    </section>
  );
}

export function RestaurantProfileSection({ restaurantId }: RestaurantProfileSectionProps) {
  const { data, error, isLoading, refetch } = useOpsRestaurantDetails(restaurantId);
  const gbpConnectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  // The discovery drawer save scope is owned by RestaurantBusinessContextSection,
  // but we still subscribe here so the rail can surface a Draft badge.
  void useOpsRestaurantBusinessContext(restaurantId);
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
  const [discoverySheetOpen, setDiscoverySheetOpen] = useState(false);
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
      if (raw === PROFILE_DISCOVERY_DEFINITION.anchorId) {
        setDiscoverySheetOpen(true);
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
  const googleStatusLabel =
    gbpConnectionQuery.data?.status === 'linked'
      ? googleDifferenceCount > 0
        ? `${googleDifferenceCount} Google difference${googleDifferenceCount === 1 ? '' : 's'}`
        : 'Google in sync'
      : 'Google not linked';
  const googleStatusDetail =
    gbpConnectionQuery.data?.status === 'linked'
      ? googleDifferenceCount > 0
        ? 'Review differences before importing so guest-facing details stay intentional.'
        : 'Google fields match this profile snapshot.'
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
  const handleSelectProfileSection = useCallback((sectionId: ProfileSectionId) => {
    const section = findProfileSection(sectionId);
    setActiveSectionId(sectionId);
    window.history.replaceState(null, '', `#${section.anchorId}`);
    requestAnimationFrame(() => {
      document.getElementById(section.anchorId)?.scrollIntoView({ block: 'start' });
    });
  }, []);
  const handleOpenDiscovery = useCallback(() => {
    setDiscoverySheetOpen(true);
    window.history.replaceState(null, '', '#profile-discovery');
  }, []);
  const handleDiscoveryOpenChange = useCallback((open: boolean) => {
    setDiscoverySheetOpen(open);
    if (!open && window.location.hash === `#${PROFILE_DISCOVERY_DEFINITION.anchorId}`) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
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
  const sectionRailItems: RestaurantSettingsCommandRailItem[] = PROFILE_SECTION_DEFINITIONS.map(
    (section) => {
      const isDirty = dirtyState[section.dirtyKey];
      const isMissingRequired = missingRequiredSectionIds.has(section.id);
      return {
        label: section.navLabel,
        description: section.audience,
        isActive: section.id === activeSectionId,
        onSelect: () => handleSelectProfileSection(section.id),
        Icon: section.icon,
        badge: isDirty ? 'Draft' : isMissingRequired ? 'Required' : undefined,
      };
    },
  );
  const discoveryRailItem: RestaurantSettingsCommandRailItem = {
    label: PROFILE_DISCOVERY_DEFINITION.navLabel,
    description: PROFILE_DISCOVERY_DEFINITION.description,
    onSelect: handleOpenDiscovery,
    Icon: Compass,
    badge: discoveryDirty ? 'Draft' : undefined,
  };
  const railItems: RestaurantSettingsCommandRailItem[] = [
    ...sectionRailItems,
    discoveryRailItem,
  ];

  return (
    <ProfileShell railItems={railItems}>
      <div className="flex flex-col gap-4">
        <ProfileOverviewCard
          restaurantName={derivedRestaurantName}
          logoUrl={previewLogoUrl ?? null}
          bookingSlug={previewValues.slug || null}
          readinessScore={readiness.score}
          readinessStageLabel={readinessStageLabel}
          completedCount={readiness.completed.length}
          totalCount={readiness.missing.length + readiness.completed.length}
          missingRequired={readiness.missingRequired}
          missingOptional={readiness.missing.filter((item) => !item.required)}
          googleStatusLabel={
            gbpConnectionQuery.data?.status === 'linked'
              ? googleStatusLabel
              : 'Not linked'
          }
          googleStatusDetail={googleStatusDetail}
          googleDifferenceCount={googleDifferenceCount}
          googleHref={`${REVIEW_GBP_HREF}#gbp-connection`}
          nextActionLabel={nextReadinessItem ? `Fix ${nextReadinessItem.label}` : null}
          nextActionDescription={
            nextReadinessItem
              ? 'Complete the next required item to make the booking link reliable for guests.'
              : 'Required profile fields are complete. You can now polish discovery details.'
          }
          onJumpToBooking={() => handleFocusReadinessItem('bookingUrl')}
          onJumpToNextAction={
            nextReadinessItem
              ? () => handleFocusReadinessItem(nextReadinessItem.key)
              : null
          }
          onFocusItem={handleFocusReadinessItem}
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
                  onDirtyChange={dirtyHandlers.brand}
                  onDraftChange={draftHandlers.brand}
                  gbpFieldVerifications={profileVerification.fields}
                />
              </>
            ) : null}
            {section.id === 'contact' ? (
              <ContactLocationSubform
                restaurantId={restaurantId}
                initialValues={initialValues}
                formId={PROFILE_SECTION_FORMS.contact}
                onDirtyChange={dirtyHandlers.contact}
                onDraftChange={draftHandlers.contact}
                gbpFieldVerifications={profileVerification.fields}
              />
            ) : null}
            {section.id === 'advanced' ? (
              <AdvancedIdentitySubform
                restaurantId={restaurantId}
                initialValues={initialValues}
                formId={PROFILE_SECTION_FORMS.advanced}
                onDirtyChange={dirtyHandlers.advanced}
                onDraftChange={draftHandlers.advanced}
              />
            ) : null}
            {section.id === 'notifications' ? (
              <ManagerNotificationsSubform
                restaurantId={restaurantId}
                initialValues={initialValues}
                formId={PROFILE_SECTION_FORMS.notifications}
                onDirtyChange={dirtyHandlers.notifications}
                onDraftChange={draftHandlers.notifications}
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
          onOpenDiscovery={handleOpenDiscovery}
        />
      </div>

      <div id={PROFILE_DISCOVERY_DEFINITION.anchorId} className="sr-only" aria-hidden="true" />
      <DiscoverySheet open={discoverySheetOpen} onOpenChange={handleDiscoveryOpenChange}>
        <RestaurantBusinessContextSection
          restaurantId={restaurantId}
          embedded
          onDirtyChange={dirtyHandlers.discovery}
        />
      </DiscoverySheet>
    </ProfileShell>
  );
}
