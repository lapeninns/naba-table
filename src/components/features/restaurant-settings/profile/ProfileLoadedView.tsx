'use client';

import { ProfileSectionBody } from './ProfileSectionBody';
import { ProfileSectionPane } from './ProfileSectionPane';
import { PROFILE_SECTION_DEFINITIONS } from './profileSections';
import { ProfileShell } from './ProfileShell';
import { ProfileStatusBar } from './ProfileStatusBar';
import { UnifiedActionBar } from './UnifiedActionBar';

import type { deriveProfileVerification } from '../google-business-profile/googleBusinessProfileVerification';
import type { RestaurantLogoUploader } from '../RestaurantLogoUploader';
import type {
  ProfileDirtyKey,
  ProfileDirtySection,
  ReadinessItemKey,
} from '../restaurantProfileModel';
import type { RestaurantSettingsCommandRailItem } from '../shared';
import type { ProfileSectionDefinition, ProfileSectionId } from './profileSections';
import type {
  RestaurantDetailsDraftValues,
  RestaurantDetailsFormValues,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import type { RestaurantProfile } from '@/services/ops/restaurants';
import type { ComponentProps } from 'react';

type ProfileLoadedViewProps = {
  restaurantId: string;
  railItems: RestaurantSettingsCommandRailItem[];
  activeSectionId: ProfileSectionId;
  activeSection: ProfileSectionDefinition;
  dirtyState: Record<ProfileDirtyKey, boolean>;
  dirtyHandlers: Record<ProfileDirtyKey, (dirty: boolean) => void>;
  draftHandlers: Partial<
    Record<ProfileDirtyKey, (draft: RestaurantDetailsDraftValues, dirty: boolean) => void>
  >;
  dirtyFormSections: readonly (ProfileDirtySection & { formId: string })[];
  discoveryDirty: boolean;
  missingRequiredSectionIds: ReadonlySet<ProfileSectionId>;
  initialValues: RestaurantDetailsFormValues;
  restaurantName: string;
  profile: RestaurantProfile | null | undefined;
  updateMutation: ComponentProps<typeof RestaurantLogoUploader>['updateMutation'];
  isLoading: boolean;
  onLogoPreviewChange: (previewUrl: string | null | undefined) => void;
  onResetDraftChange: (key: ProfileDirtyKey, resetDraft: (() => void) | null) => void;
  gbpFieldVerifications: ReturnType<typeof deriveProfileVerification>['fields'];
  bookingSlug: string | null;
  readinessScore: number;
  readinessStageLabel: string;
  completedCount: number;
  totalCount: number;
  requiredRemainingCount: number;
  googleHint: string | null;
  googleHref: string;
  nextActionLabel: string | null;
  nextActionDescription: string;
  nextReadinessItemKey: ReadinessItemKey | null;
  onFocusReadinessItem: (key: ReadinessItemKey) => void;
  onSaveAll: () => void;
  onCancelActive: () => void;
  gbpDriftCount: number;
  onCompareWithGoogle?: () => void;
};

export function ProfileLoadedView({
  restaurantId,
  railItems,
  activeSectionId,
  activeSection,
  dirtyState,
  dirtyHandlers,
  draftHandlers,
  dirtyFormSections,
  discoveryDirty,
  missingRequiredSectionIds,
  initialValues,
  restaurantName,
  profile,
  updateMutation,
  isLoading,
  onLogoPreviewChange,
  onResetDraftChange,
  gbpFieldVerifications,
  bookingSlug,
  readinessScore,
  readinessStageLabel,
  completedCount,
  totalCount,
  requiredRemainingCount,
  googleHint,
  googleHref,
  nextActionLabel,
  nextActionDescription,
  nextReadinessItemKey,
  onFocusReadinessItem,
  onSaveAll,
  onCancelActive,
  gbpDriftCount,
  onCompareWithGoogle,
}: ProfileLoadedViewProps) {
  return (
    <ProfileShell railItems={railItems}>
      <div className="flex flex-col gap-4">
        <ProfileStatusBar
          bookingSlug={bookingSlug}
          readinessScore={readinessScore}
          readinessStageLabel={readinessStageLabel}
          completedCount={completedCount}
          totalCount={totalCount}
          requiredRemainingCount={requiredRemainingCount}
          googleHint={googleHint}
          googleHref={googleHref}
          nextActionLabel={nextActionLabel}
          nextActionDescription={nextActionDescription}
          onJumpToBooking={() => onFocusReadinessItem('bookingUrl')}
          onJumpToNextAction={
            nextReadinessItemKey ? () => onFocusReadinessItem(nextReadinessItemKey) : null
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
            <ProfileSectionBody
              section={section}
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              logoUrl={profile?.logoUrl ?? null}
              updateMutation={updateMutation}
              isLoading={isLoading}
              onLogoPreviewChange={onLogoPreviewChange}
              initialValues={initialValues}
              dirtyHandlers={dirtyHandlers}
              draftHandlers={draftHandlers}
              onResetDraftChange={onResetDraftChange}
              gbpFieldVerifications={gbpFieldVerifications}
            />
          </ProfileSectionPane>
        ))}

        <UnifiedActionBar
          dirtyFormSections={dirtyFormSections}
          discoveryDirty={discoveryDirty}
          activeSection={activeSection}
          lastSavedAt={profile?.updatedAt ?? null}
          onSaveAll={onSaveAll}
          onCancelActive={onCancelActive}
          gbpDriftCount={gbpDriftCount}
          onCompareWithGoogle={onCompareWithGoogle}
        />
      </div>
    </ProfileShell>
  );
}
