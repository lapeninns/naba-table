'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';

import {
  AdvancedIdentitySubform,
  BrandIdentitySubform,
  ContactLocationSubform,
} from '@/components/ops/restaurants/RestaurantDetailsForm';

import { ProfileFieldGroup } from '../../../../../components/ops/restaurants/details/shared';
import { RestaurantLogoUploader } from '../RestaurantLogoUploader';
import { deriveReadiness, type ReadinessItemKey } from '../restaurantProfileModel';
import { RESTAURANT_SETTINGS_ROUTE_MAP, RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS } from '../routes';
import {
  SettingsReviewChangesDialog,
  SettingsSaveBar,
  SettingsStatusLine,
  pluralise,
  scrollToSettingsSection,
  useSettingsSectionSpy,
  type RestaurantSettingsCommandRailItem,
} from '../shared';
import { useProfileDraft, useProfileEditorAnalytics, useProfileGbpDraftOverrides } from './hooks';
import { READINESS_FIELD_TARGETS } from './profileReadinessTargets';
import { ProfileSectionPane } from './ProfileSectionPane';
import {
  PROFILE_BOOKING_URL_ANCHOR_ID,
  PROFILE_FIELD_GROUPS,
  PROFILE_SECTION_DEFINITIONS,
  focusProfileElement,
  type ProfileSectionId,
} from './profileSections';
import { PROFILE_LAYOUT_GRID_CLASS, ProfileShell } from './ProfileShell';
import {
  ProfileGoogleCard,
  ProfileReadinessPanel,
  ProfileReadinessSummary,
} from './ProfileStatusBar';

import type { ProfileSubformProps } from '../../../../../components/ops/restaurants/details/shared';
import type { deriveProfileVerification } from '../google-business-profile/googleBusinessProfileVerification';
import type { RestaurantProfile } from '@/services/ops/restaurants';

type ProfileLoadedViewProps = {
  restaurantId: string;
  profile: RestaurantProfile;
  updateMutation: ComponentProps<typeof RestaurantLogoUploader>['updateMutation'];
  gbpFieldVerifications: ReturnType<typeof deriveProfileVerification>['fields'];
  registerGbpDraftOverride?: (fieldKey: string, value: unknown | null) => void;
  clearGbpDraftOverrides?: (fieldKeys?: ReadonlyArray<string>) => void;
  googleLinked: boolean;
  googleDetail: string;
  googleHref: string;
  gbpDriftCount: number;
  onCompareWithGoogle?: () => void;
};

const GROUP_ANCHOR_IDS = PROFILE_FIELD_GROUPS.map((group) => group.anchorId);
/** Every in-page anchor other pages may deep-link to. */
const DEEP_LINK_ANCHOR_IDS = [
  ...PROFILE_SECTION_DEFINITIONS.map((section) => section.anchorId),
  ...GROUP_ANCHOR_IDS,
  PROFILE_BOOKING_URL_ANCHOR_ID,
];
const LEAVE_MESSAGE = 'You have unsaved restaurant profile changes. Leave without saving them?';

/**
 * The Restaurant profile page once loaded: one public-details form with a jump bar for its
 * groups, one page-wide draft, one save bar, and the readiness checklist beside it from `xl`.
 * Manager alerts live on the Staff communications page.
 */
export function ProfileLoadedView({
  restaurantId,
  profile,
  updateMutation,
  gbpFieldVerifications,
  registerGbpDraftOverride,
  clearGbpDraftOverrides,
  googleLinked,
  googleDetail,
  googleHref,
  gbpDriftCount,
  onCompareWithGoogle,
}: ProfileLoadedViewProps) {
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null | undefined>(undefined);
  const previewLogoUrl = logoPreviewUrl === undefined ? profile.logoUrl : logoPreviewUrl;
  const updateProfile = updateMutation.mutateAsync;

  // Analytics needs the draft's readiness, and the draft reports Save; a ref breaks the loop.
  const saveRequestedRef = useRef<(sectionIds: readonly ProfileSectionId[]) => void>(() => {});
  const handleSaveRequested = useCallback(
    (sectionIds: readonly ProfileSectionId[]) => saveRequestedRef.current(sectionIds),
    [],
  );
  const draft = useProfileDraft({
    restaurantId,
    profile,
    updateProfile,
    sections: PROFILE_SECTION_DEFINITIONS,
    unsavedEntryId: RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS.profile,
    leaveMessage: LEAVE_MESSAGE,
    onSaveRequested: handleSaveRequested,
  });

  const readiness = useMemo(
    () => deriveReadiness(draft.previewValues, previewLogoUrl),
    [draft.previewValues, previewLogoUrl],
  );
  const dirtySectionIds = useMemo(
    () => draft.dirtySections.map((section) => section.id),
    [draft.dirtySections],
  );
  const { emitSaveAllClicked } = useProfileEditorAnalytics({
    restaurantId,
    data: profile,
    dirtySectionIds,
    formDirty: draft.isDirty,
    readiness,
  });
  useEffect(() => {
    saveRequestedRef.current = emitSaveAllClicked;
  }, [emitSaveAllClicked]);

  useProfileGbpDraftOverrides({
    previewValues: draft.previewValues,
    registerGbpDraftOverride,
    clearGbpDraftOverrides,
  });

  // Other pages deep-link to a group (#profile-contact); scroll there once it exists.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && DEEP_LINK_ANCHOR_IDS.includes(hash)) {
      scrollToSettingsSection(hash);
    }
  }, []);

  const activeAnchorId = useSettingsSectionSpy(GROUP_ANCHOR_IDS);
  const { dirtyFields, visibleErrors } = draft;
  const railItems = useMemo<RestaurantSettingsCommandRailItem[]>(
    () =>
      PROFILE_FIELD_GROUPS.map((group) => {
        const issues = group.fields.filter((field) => visibleErrors[field]).length;
        const edited = group.fields.some((field) => dirtyFields.includes(field));
        return {
          label: group.name,
          targetId: group.anchorId,
          isActive: group.anchorId === activeAnchorId,
          badge:
            issues > 0
              ? { label: pluralise(issues, 'issue'), tone: 'issue' as const }
              : edited
                ? { label: 'Edited', tone: 'edited' as const }
                : null,
        };
      }),
    [activeAnchorId, dirtyFields, visibleErrors],
  );

  const handleFocusReadinessItem = useCallback((key: ReadinessItemKey) => {
    focusProfileElement(READINESS_FIELD_TARGETS[key]);
  }, []);

  const subformProps: ProfileSubformProps = {
    state: draft.draft,
    savedState: draft.savedState,
    errors: draft.visibleErrors,
    onFieldChange: draft.setField,
    onFieldBlur: draft.markTouched,
    gbpFieldVerifications,
  };
  const restaurantName = draft.draft.name.trim() || profile.name || 'Restaurant';
  const statusBySection = new Map(
    draft.sectionStatuses.map((status) => [status.section.id, status] as const),
  );

  const [identityGroup, contactGroup] = PROFILE_FIELD_GROUPS;

  // Name, booking page link and description form one group; location and contact follow.
  const renderSectionBody = () => (
    <div className="flex flex-col gap-8">
      <div id={identityGroup?.anchorId} className="min-w-0 scroll-mt-28">
        <ProfileFieldGroup title={identityGroup?.name ?? 'Name and booking link'}>
          <RestaurantLogoUploader
            restaurantId={restaurantId}
            restaurantName={restaurantName}
            logoUrl={profile.logoUrl}
            updateMutation={updateMutation}
            onPreviewChange={setLogoPreviewUrl}
          />
          <BrandIdentitySubform
            {...subformProps}
            afterName={
              <div id={PROFILE_BOOKING_URL_ANCHOR_ID} className="min-w-0 scroll-mt-28">
                <AdvancedIdentitySubform {...subformProps} />
              </div>
            }
          />
        </ProfileFieldGroup>
      </div>
      <div
        id={contactGroup?.anchorId}
        className="min-w-0 scroll-mt-28 border-t border-border/60 pt-6"
      >
        <ContactLocationSubform {...subformProps} />
      </div>
    </div>
  );

  return (
    <ProfileShell
      railItems={railItems}
      status={
        <SettingsStatusLine
          changeCount={draft.dirtyFields.length}
          issueCount={draft.issueCount}
          progress={draft.progress}
          failure={draft.failure}
          lastSavedAt={profile.updatedAt}
        />
      }
    >
      <div className={PROFILE_LAYOUT_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-4">
          <ProfileReadinessSummary
            className="xl:hidden"
            items={readiness.items}
            onFocusItem={handleFocusReadinessItem}
          />
          {PROFILE_SECTION_DEFINITIONS.map((section) => {
            const status = statusBySection.get(section.id);
            return (
              <ProfileSectionPane
                key={section.id}
                section={section}
                isDirty={status?.isDirty ?? false}
                issueCount={status?.visibleIssueCount ?? 0}
              >
                {renderSectionBody()}
              </ProfileSectionPane>
            );
          })}
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">Related settings.</span> Manager alerts
            and the daily booking summary are on{' '}
            <Link
              href={RESTAURANT_SETTINGS_ROUTE_MAP['staff-communications'].href}
              className="underline underline-offset-2"
            >
              Staff communications
            </Link>
            .
          </p>
        </div>

        <aside
          aria-label="Profile readiness and Google"
          className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4"
        >
          <ProfileReadinessPanel
            className="hidden xl:block"
            items={readiness.items}
            onFocusItem={handleFocusReadinessItem}
          />
          <ProfileGoogleCard
            googleLinked={googleLinked}
            googleDetail={googleDetail}
            googleHref={googleHref}
            gbpDriftCount={gbpDriftCount}
            onCompareWithGoogle={onCompareWithGoogle}
          />
        </aside>
      </div>

      <SettingsSaveBar
        changeCount={draft.dirtyFields.length}
        sectionNames={draft.dirtySections.map((section) => section.name)}
        issueCount={draft.issueCount}
        progress={draft.progress}
        failure={draft.failure}
        onSave={() => void draft.save()}
        onDiscard={draft.discard}
        onShowFirstIssue={draft.showFirstIssue}
        onReview={() => draft.setReviewOpen(true)}
      />
      <SettingsReviewChangesDialog
        open={draft.reviewOpen}
        onOpenChange={draft.setReviewOpen}
        groups={draft.reviewGroups}
        onUndoGroup={draft.undoSection}
        onSave={() => void draft.save()}
      />
    </ProfileShell>
  );
}
