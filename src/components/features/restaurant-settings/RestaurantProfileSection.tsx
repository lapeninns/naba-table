'use client';

import { useCallback, useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@/hooks/ops/useOpsRestaurantDetails';
import { opsHref } from '@/lib/url/opsHref';

import { openProfileWorkspaceCompare } from './gbp/openSettingsCompare';
import { PROFILE_WORKSPACE_COMPARE_SECTION_KEYS } from './gbp/profileCompareSections';
import { useOptionalGbpDrift } from './gbp-drift/useGbpDrift';
import { useGbpDriftSectionStatus, useGbpDriftStatus } from './GbpDriftProvider';
import { deriveProfileVerification } from './google-business-profile/googleBusinessProfileVerification';
import { ProfileLoadedView, ProfileShell } from './profile';
import {
  useProfileDraftState,
  useProfileEditorAnalytics,
  useProfileGbpDraftOverrides,
  useProfileReadiness,
  useProfileSectionNav,
} from './profile/hooks';
import {
  SettingsCard,
  SettingsSectionStates,
  type RestaurantSettingsCommandRailItem,
} from './shared';

const REVIEW_GBP_HREF = opsHref('/settings/restaurant/google-business-profile');

type RestaurantProfileSectionProps = {
  restaurantId: string | null;
};

export function RestaurantProfileSection({ restaurantId }: RestaurantProfileSectionProps) {
  const { data, error, isLoading, refetch } = useOpsRestaurantDetails(restaurantId);
  const gbpConnectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const { status: gbpStatus } = useGbpDriftStatus();
  const gbpDrift = useOptionalGbpDrift();
  const registerGbpDraftOverride = gbpDrift?.registerDraftOverride;
  const clearGbpDraftOverrides = gbpDrift?.clearDraftOverrides;
  const profileDriftStatus = useGbpDriftSectionStatus(PROFILE_WORKSPACE_COMPARE_SECTION_KEYS);
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);

  const {
    dirtyState,
    dirtySections,
    dirtyFormSections,
    formDirty,
    initialValues,
    previewValues,
    previewLogoUrl,
    setLogoPreviewUrl,
    dirtyHandlers,
    draftHandlers,
    registerResetDraftHandler,
    resetSectionDraft,
  } = useProfileDraftState(data);
  const { activeSectionId, activeSection, setActiveSectionId, buildRailItems } =
    useProfileSectionNav();

  useProfileGbpDraftOverrides({
    previewValues,
    registerGbpDraftOverride,
    clearGbpDraftOverrides,
  });
  const {
    readiness,
    missingRequiredSectionIds,
    readinessStageLabel,
    nextReadinessItem,
    handleFocusReadinessItem,
  } = useProfileReadiness({
    previewValues,
    previewLogoUrl,
    setActiveSectionId,
  });
  const { emitSaveAllClicked } = useProfileEditorAnalytics({
    restaurantId,
    data,
    dirtySections,
    formDirty,
    readiness,
  });

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
    ? PROFILE_WORKSPACE_COMPARE_SECTION_KEYS.reduce(
        (total, sectionKey) => total + gbpDrift.driftCountBySection[sectionKey],
        0,
      )
    : 0;
  const profileReviewCount = Math.max(
    googleDifferenceCount,
    profileDriftStatus.needsReviewCount,
    liveProfileReviewCount,
  );
  const isGoogleLinked = gbpConnectionQuery.data?.status === 'linked' || gbpDrift?.isLinked;
  const handleCompareProfileWithGoogle = useCallback(() => {
    if (!gbpDrift) return;
    openProfileWorkspaceCompare(gbpDrift.openCompare, profileReviewCount);
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
  const handleSaveAllProfileForms = useCallback(() => {
    emitSaveAllClicked(dirtyFormSections);
    dirtyFormSections.forEach((section) => {
      const form = document.getElementById(section.formId);
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      }
    });
  }, [dirtyFormSections, emitSaveAllClicked]);
  const handleCancelActiveSection = useCallback(() => {
    resetSectionDraft(activeSection.dirtyKey);
  }, [activeSection.dirtyKey, resetSectionDraft]);

  const railItems: RestaurantSettingsCommandRailItem[] = useMemo(
    () => buildRailItems({ dirtyState, missingRequiredSectionIds }),
    [buildRailItems, dirtyState, missingRequiredSectionIds],
  );

  return (
    <SettingsSectionStates
      restaurantId={restaurantId}
      isLoading={isLoading && !data}
      error={error}
      noRestaurant={
        <ProfileShell>
          <SettingsCard
            title="Select a restaurant"
            description="Pick a restaurant from the sidebar switcher to manage what guests and staff see."
          >
            <Text variant="caption">
              Choose a restaurant using the sidebar switcher to update its public details and team
              alerts.
            </Text>
          </SettingsCard>
        </ProfileShell>
      }
      loading={
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
      }
      errorState={(loadError) => (
        <ProfileShell>
          <SettingsCard
            title="Restaurant profile"
            description="Update public details and team alerts."
          >
            <Alert variant="destructive">
              <AlertTitle>Unable to load restaurant details</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{loadError.message}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </SettingsCard>
        </ProfileShell>
      )}
    >
      {(activeRestaurantId) => (
        <ProfileLoadedView
          restaurantId={activeRestaurantId}
          railItems={railItems}
          activeSectionId={activeSectionId}
          activeSection={activeSection}
          dirtyState={dirtyState}
          dirtyHandlers={dirtyHandlers}
          draftHandlers={draftHandlers}
          dirtyFormSections={dirtyFormSections}
          missingRequiredSectionIds={missingRequiredSectionIds}
          initialValues={initialValues}
          restaurantName={derivedRestaurantName}
          profile={data}
          updateMutation={updateMutation}
          isLoading={isLoading && !data}
          onLogoPreviewChange={setLogoPreviewUrl}
          onResetDraftChange={registerResetDraftHandler}
          gbpFieldVerifications={profileVerification.fields}
          bookingSlug={previewValues.slug || null}
          readinessScore={readiness.score}
          readinessStageLabel={readinessStageLabel}
          completedCount={readiness.completed.length}
          totalCount={readiness.missing.length + readiness.completed.length}
          requiredRemainingCount={readiness.missingRequired.length}
          googleHint={isGoogleLinked ? null : googleStatusDetail}
          googleHref={`${REVIEW_GBP_HREF}#gbp-connection`}
          googleLinked={Boolean(isGoogleLinked)}
          nextActionLabel={nextReadinessItem ? `Fix ${nextReadinessItem.label}` : null}
          nextActionDescription={
            nextReadinessItem
              ? 'Complete the next required item to make the booking link reliable for guests.'
              : 'Required profile fields are complete. You can now polish discovery details.'
          }
          nextReadinessItemKey={nextReadinessItem?.key ?? null}
          onFocusReadinessItem={handleFocusReadinessItem}
          onSaveAll={handleSaveAllProfileForms}
          onCancelActive={handleCancelActiveSection}
          gbpDriftCount={profileReviewCount}
          onCompareWithGoogle={gbpDrift?.isLinked ? handleCompareProfileWithGoogle : undefined}
        />
      )}
    </SettingsSectionStates>
  );
}
