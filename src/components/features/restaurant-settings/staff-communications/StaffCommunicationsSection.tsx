'use client';

import { CircleAlert } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { ManagerNotificationsSubform } from '@/components/ops/restaurants/RestaurantDetailsForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  SettingsReviewChangesDialog,
  SettingsSaveBar,
  SettingsSectionStates,
  SettingsStatusLine,
  getSettingsSaveReasonCode,
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
      <Card variant="compact" className="border-border/70" role="status" aria-live="polite">
        <span className="sr-only">Loading staff communications…</span>
        <div
          className="flex flex-col gap-2 border-b border-border/60 px-4 py-4 sm:px-5"
          aria-hidden
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="flex flex-col gap-5 px-4 py-5 sm:px-5" aria-hidden>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    </StaffCommunicationsShell>
  );
}

type UpdateMutation = ReturnType<typeof useOpsUpdateRestaurantDetails>;

function StaffCommunicationsLoadedView({
  restaurantId,
  profile,
  updateMutation,
}: {
  restaurantId: string;
  profile: RestaurantProfile;
  updateMutation: UpdateMutation;
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
      <div className="flex min-w-0 max-w-4xl flex-col gap-4">
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
      error={error}
      noRestaurant={
        <StaffCommunicationsShell>
          <OpsEmptyState
            title="Select a restaurant"
            description="Choose a restaurant with the sidebar switcher to edit who is told about its bookings."
          />
        </StaffCommunicationsShell>
      }
      loading={<StaffCommunicationsLoading />}
      errorState={(loadError) => (
        <StaffCommunicationsShell>
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertTitle>Couldn’t load staff communications</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>
                Your saved settings are unchanged. Reason code{' '}
                <span className="font-mono">{getSettingsSaveReasonCode(loadError)}</span>
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
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
          />
        ) : (
          <StaffCommunicationsLoading />
        )
      }
    </SettingsSectionStates>
  );
}
