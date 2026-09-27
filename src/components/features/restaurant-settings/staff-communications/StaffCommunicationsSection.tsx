'use client';

import { ManagerNotificationsSubform } from '@/components/ops/restaurants/RestaurantDetailsForm';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@/hooks/ops/useOpsRestaurantDetails';

import { useProfileDraft } from '../profile/hooks';
import { ProfileSectionPane } from '../profile/ProfileSectionPane';
import { STAFF_COMMUNICATIONS_SECTION_DEFINITIONS } from '../profile/profileSections';
import { RESTAURANT_SETTINGS_ROUTE_MAP, RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS } from '../routes';
import {
  RestaurantSettingsCommandCenter,
  SettingsLoadErrorAlert,
  SettingsNoRestaurantState,
  SettingsRefreshErrorAlert,
  SettingsReviewChangesDialog,
  SettingsSaveBar,
  SettingsSectionSkeleton,
  SettingsSectionStates,
  SettingsStatusLine,
} from '../shared';

import type { ProfileSubformProps } from '../../../../../components/ops/restaurants/details/shared';
import type { RestaurantProfile } from '@/services/ops/restaurants';
import type { ReactNode } from 'react';

const ROUTE = RESTAURANT_SETTINGS_ROUTE_MAP['staff-communications'];
const LEAVE_MESSAGE = 'You have unsaved staff communication changes. Leave without saving them?';

function StaffCommunicationsShell({
  status,
  children,
}: {
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RestaurantSettingsCommandCenter
      title={ROUTE.title}
      description={ROUTE.description}
      status={status}
    >
      {children}
    </RestaurantSettingsCommandCenter>
  );
}

function StaffCommunicationsLoading() {
  return (
    <StaffCommunicationsShell>
      <SettingsSectionSkeleton label="Loading staff communications…" purposeLine={false} />
    </StaffCommunicationsShell>
  );
}

type UpdateMutation = ReturnType<typeof useOpsUpdateRestaurantDetails>;

function StaffCommunicationsLoadedView({
  restaurantId,
  profile,
  updateMutation,
  notice,
}: {
  restaurantId: string;
  profile: RestaurantProfile;
  updateMutation: UpdateMutation;
  /** Non-blocking notice shown above the form, e.g. a failed background refresh. */
  notice?: ReactNode;
}) {
  const draft = useProfileDraft({
    restaurantId,
    profile,
    updateProfile: updateMutation.mutateAsync,
    sections: STAFF_COMMUNICATIONS_SECTION_DEFINITIONS,
    unsavedEntryId: RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS['staff-communications'],
    leaveMessage: LEAVE_MESSAGE,
  });

  const subformProps: ProfileSubformProps = {
    state: draft.draft,
    savedState: draft.savedState,
    errors: draft.visibleErrors,
    onFieldChange: draft.setField,
    onFieldBlur: draft.markTouched,
  };

  return (
    <StaffCommunicationsShell
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
      <div className="flex min-w-0 flex-col gap-4">
        {notice}
        {draft.sectionStatuses.map(({ section, isDirty, visibleIssueCount }) => (
          <ProfileSectionPane
            key={section.id}
            section={section}
            isDirty={isDirty}
            issueCount={visibleIssueCount}
          >
            <ManagerNotificationsSubform
              {...subformProps}
              whatsappTurnedOff={draft.whatsappTurnedOff}
            />
          </ProfileSectionPane>
        ))}
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
    </StaffCommunicationsShell>
  );
}

/**
 * Staff communications: the restaurant's manager alert settings (alert number, daily booking
 * summary, WhatsApp) and the manager name. Saved on the restaurant record, like Profile.
 */
export function StaffCommunicationsSection({ restaurantId }: { restaurantId: string | null }) {
  const { data, error, isLoading, refetch } = useOpsRestaurantDetails(restaurantId);
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);

  return (
    <SettingsSectionStates
      restaurantId={restaurantId}
      isLoading={isLoading && !data}
      // A failed background refresh keeps the loaded page and its unsaved edits.
      error={data ? null : error}
      noRestaurant={
        <StaffCommunicationsShell>
          <SettingsNoRestaurantState task="edit who is told about its bookings" />
        </StaffCommunicationsShell>
      }
      loading={<StaffCommunicationsLoading />}
      errorState={(loadError) => (
        <StaffCommunicationsShell>
          <SettingsLoadErrorAlert
            title="Couldn’t load staff communications"
            error={loadError}
            onRetry={() => void refetch()}
          />
        </StaffCommunicationsShell>
      )}
    >
      {(activeRestaurantId) =>
        data ? (
          <StaffCommunicationsLoadedView
            key={activeRestaurantId}
            restaurantId={activeRestaurantId}
            profile={data}
            updateMutation={updateMutation}
            notice={
              error ? (
                <SettingsRefreshErrorAlert error={error} onRetry={() => void refetch()} />
              ) : null
            }
          />
        ) : (
          <StaffCommunicationsLoading />
        )
      }
    </SettingsSectionStates>
  );
}
