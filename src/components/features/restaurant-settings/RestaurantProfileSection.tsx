'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@/hooks/ops/useOpsRestaurantDetails';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { openProfileWorkspaceCompare } from './gbp/openSettingsCompare';
import { PROFILE_WORKSPACE_COMPARE_SECTION_KEYS } from './gbp/profileCompareSections';
import { useOptionalGbpDrift } from './gbp-drift/useGbpDrift';
import { useGbpDriftSectionStatus, useGbpDriftStatus } from './GbpDriftProvider';
import { deriveProfileVerification } from './google-business-profile/googleBusinessProfileVerification';
import { PROFILE_LAYOUT_GRID_CLASS, ProfileLoadedView, ProfileShell } from './profile';
import {
  SETTINGS_CARD_CLASS,
  SettingsLoadErrorAlert,
  SettingsNoRestaurantState,
  SettingsRefreshErrorAlert,
  SettingsSectionStates,
} from './shared';

const REVIEW_GBP_HREF = opsHref('/settings/restaurant/google-business-profile');

type RestaurantProfileSectionProps = {
  restaurantId: string | null;
};

function ProfileLoadingState() {
  return (
    <ProfileShell>
      <div className={PROFILE_LAYOUT_GRID_CLASS} role="status" aria-live="polite">
        <span className="sr-only">Loading restaurant profile…</span>
        <div className="flex min-w-0 flex-col gap-4" aria-hidden>
          {[0, 1].map((index) => (
            <Card key={index} variant="compact" className={SETTINGS_CARD_CLASS}>
              <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-4 sm:px-5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
              <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
        <Card
          variant="compact"
          className={cn(SETTINGS_CARD_CLASS, 'hidden p-4 xl:block')}
          aria-hidden
        >
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Card>
      </div>
    </ProfileShell>
  );
}

export function RestaurantProfileSection({ restaurantId }: RestaurantProfileSectionProps) {
  const { data, error, isLoading, refetch } = useOpsRestaurantDetails(restaurantId);
  const gbpConnectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const { status: gbpStatus } = useGbpDriftStatus();
  const gbpDrift = useOptionalGbpDrift();
  const profileDriftStatus = useGbpDriftSectionStatus(PROFILE_WORKSPACE_COMPARE_SECTION_KEYS);
  const router = useRouter();
  // The sidebar switcher and booking links read memberships from the server layout.
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId, {
    onIdentityChange: () => router.refresh(),
  });

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
      ? 'Review profile and discovery differences in the Google workspace before importing or exporting.'
      : gbpConnectionQuery.data?.status === 'linked'
        ? googleDifferenceCount > 0
          ? 'Review differences before importing so guest-facing details stay intentional.'
          : 'Google fields match this profile.'
        : hasGbpDriftContext && gbpStatus.kind === 'connected_outdated'
          ? gbpStatus.detail
          : isGoogleLinked
            ? 'Linked. Differences with Google are reviewed in the Google workspace.'
            : 'Optional. Link Google only when you need import or side-by-side comparison.';

  return (
    <SettingsSectionStates
      restaurantId={restaurantId}
      isLoading={isLoading && !data}
      // A failed background refresh keeps the loaded page and its unsaved edits.
      error={data ? null : error}
      noRestaurant={
        <ProfileShell>
          <SettingsNoRestaurantState task="edit its public details" />
        </ProfileShell>
      }
      loading={<ProfileLoadingState />}
      errorState={(loadError) => (
        <ProfileShell>
          <SettingsLoadErrorAlert
            title="Couldn’t load the restaurant profile"
            message="Your saved details are unchanged."
            error={loadError}
            onRetry={() => void refetch()}
          />
        </ProfileShell>
      )}
    >
      {(activeRestaurantId) =>
        data ? (
          <ProfileLoadedView
            key={activeRestaurantId}
            restaurantId={activeRestaurantId}
            profile={data}
            updateMutation={updateMutation}
            gbpFieldVerifications={profileVerification.fields}
            registerGbpDraftOverride={gbpDrift?.registerDraftOverride}
            clearGbpDraftOverrides={gbpDrift?.clearDraftOverrides}
            googleLinked={Boolean(isGoogleLinked)}
            googleDetail={googleStatusDetail}
            googleHref={`${REVIEW_GBP_HREF}#gbp-connection`}
            gbpDriftCount={profileReviewCount}
            onCompareWithGoogle={gbpDrift?.isLinked ? handleCompareProfileWithGoogle : undefined}
            notice={
              error ? (
                <SettingsRefreshErrorAlert error={error} onRetry={() => void refetch()} />
              ) : null
            }
          />
        ) : (
          <ProfileLoadingState />
        )
      }
    </SettingsSectionStates>
  );
}
