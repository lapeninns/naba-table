'use client';

import { Lock } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { useOpsSession } from '@/contexts/ops-session';

import { RESTAURANT_SETTINGS_ROUTE_MAP } from '../routes';
import { RestaurantSettingsCommandCenter, SettingsSectionStates } from '../shared';
import { SettingsRefreshErrorAlert } from '../shared/SettingsRefreshErrorAlert';
import { GbpConnectionStepCard } from './components/GbpConnectionStepCard';
import { GbpLocationChooserDialog } from './components/GbpLocationChooserDialog';
import { GbpLocationStepCard } from './components/GbpLocationStepCard';
import { GbpStepCard } from './components/GbpStepCard';
import { GbpWriteControls } from './components/GbpWriteControls';
import {
  AVAILABILITY_SCHEDULE_HREF,
  GBP_REVIEW_SECTIONS,
  PROFILE_CONTACT_HREF,
} from './googleBusinessProfileWorkflow';
import {
  EmptyGbpConnectionSection,
  ErrorGbpSection,
  GoogleBusinessProfileDisconnectDialog,
  LoadingGbpSection,
  NoRestaurantGbpSection,
  PersistentGbpErrorAlert,
} from './sections';
import { useGoogleBusinessProfileSectionState } from './useGoogleBusinessProfileSectionState';

const DualSyncShell = dynamic(
  () => import('../dual-sync/DualSyncShell').then((m) => m.DualSyncShell),
  {
    loading: () => <ReviewStepLoading />,
    ssr: false,
  },
);

const ROUTE = RESTAURANT_SETTINGS_ROUTE_MAP['google-business-profile'];

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
  /** False when the comparison workspace is switched off for this deployment. */
  hasSyncWorkspace?: boolean;
};

function ReviewStepLoading() {
  return (
    <GbpStepCard step={3} title="Review differences" description="Comparing Nabatable with Google…">
      <div role="status" aria-busy="true" className="flex flex-col gap-2">
        <span className="sr-only">Loading the differences</span>
        <Skeleton className="h-16 w-full" />
      </div>
    </GbpStepCard>
  );
}

function RelatedSettings() {
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      <span className="font-medium text-foreground">Related settings.</span> Public profile fields
      (name, address, phone, links) are edited on{' '}
      <Link href={PROFILE_CONTACT_HREF} className="underline underline-offset-2">
        Restaurant profile
      </Link>
      . Hours and meal windows are edited on{' '}
      <Link href={AVAILABILITY_SCHEDULE_HREF} className="underline underline-offset-2">
        Availability &amp; Booking types
      </Link>
      .
    </p>
  );
}

export function GoogleBusinessProfileSection({
  restaurantId,
  hasSyncWorkspace = true,
}: GoogleBusinessProfileSectionProps) {
  const { permissions } = useOpsSession();
  const state = useGoogleBusinessProfileSectionState({ restaurantId });
  const { summary } = state;
  const canManageSettings = permissions.canManageSettings;

  return (
    <>
      <RestaurantSettingsCommandCenter title={ROUTE.title} description={ROUTE.description}>
        <SettingsSectionStates
          restaurantId={restaurantId}
          isLoading={state.connectionQuery.isLoading && !state.data}
          // A failed background refresh keeps the loaded page and its unsaved review decisions.
          error={state.data ? null : state.connectionQuery.error}
          noRestaurant={<NoRestaurantGbpSection />}
          loading={<LoadingGbpSection />}
          errorState={(error) => (
            <ErrorGbpSection error={error} onRetry={() => void state.connectionQuery.refetch()} />
          )}
        >
          {() =>
            state.data && restaurantId ? (
              <div className="flex min-w-0 flex-col gap-4">
                {state.connectionQuery.error ? (
                  <SettingsRefreshErrorAlert
                    error={state.connectionQuery.error}
                    onRetry={() => void state.connectionQuery.refetch()}
                  />
                ) : null}
                {state.persistentError ? (
                  <PersistentGbpErrorAlert
                    error={state.persistentError}
                    actionLabel={state.persistentErrorAction?.label}
                    onAction={state.persistentErrorAction?.onAction}
                    isActionPending={state.persistentErrorAction?.isPending}
                  />
                ) : null}

                <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
                  <GbpConnectionStepCard
                    data={state.data}
                    accountLabel={summary.accountLabel}
                    description={summary.connectionDescription}
                    done={summary.connectionDone}
                    connectError={summary.isLinked ? null : state.data.lastError}
                    onConnect={state.handleConnectGoogle}
                    isConnecting={state.startAuthorizationMutation.isPending}
                    onRefresh={summary.canRefresh ? state.refreshHandler : null}
                    isRefreshing={state.connectionQuery.isFetching}
                    onRequestDisconnect={
                      summary.canDisconnect ? state.handleRequestDisconnect : null
                    }
                    isDisconnecting={state.disconnectMutation.isPending}
                  />
                  <GbpLocationStepCard
                    step={summary.locationStep}
                    linkedLocation={state.linkedLocation}
                    hasLinkedLocation={summary.hasLinkedLocation}
                    needsReconnect={summary.status === 'reauth_required'}
                    manageHref={summary.manageOnGoogleHref}
                    onChooseLocation={() => state.setLocationChooserOpen(true)}
                    locationsErrorMessage={summary.locationsErrorMessage}
                    onRetryLocations={() => void state.locationsQuery.refetch()}
                    isRetryingLocations={state.locationsQuery.isFetching}
                  />
                </div>

                {summary.canReview && hasSyncWorkspace ? (
                  <div id="gbp-sync-review" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
                    <DualSyncShell
                      restaurantId={restaurantId}
                      sections={GBP_REVIEW_SECTIONS}
                      renderEvidence={(evidence) => (
                        <GbpWriteControls
                          restaurantId={restaurantId}
                          canManageSettings={canManageSettings}
                          syncControls={evidence.syncControls}
                          operationalPanels={evidence.operationalPanels}
                          onRequestRefresh={evidence.onRequestRefresh}
                          refreshPending={evidence.refreshPending}
                        />
                      )}
                    />
                  </div>
                ) : (
                  <>
                    <GbpStepCard
                      step={3}
                      title="Review differences"
                      description={
                        summary.isLinked
                          ? 'Google is linked, but comparison tools are currently unavailable. Review changes directly in Nabatable and on Google for now.'
                          : 'Available once a location is linked.'
                      }
                    >
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Lock className="size-4 shrink-0" aria-hidden />
                        Nothing to review yet.
                      </p>
                    </GbpStepCard>
                    {summary.isLinked && canManageSettings ? (
                      <GbpWriteControls restaurantId={restaurantId} canManageSettings />
                    ) : null}
                  </>
                )}

                <RelatedSettings />
              </div>
            ) : (
              <EmptyGbpConnectionSection />
            )
          }
        </SettingsSectionStates>
      </RestaurantSettingsCommandCenter>
      {state.data ? (
        <GbpLocationChooserDialog
          open={state.locationChooserOpen}
          onOpenChange={state.setLocationChooserOpen}
          connectedAccount={state.data.connectedGoogleEmail}
          locations={state.data.availableLocations}
          locationsArePossiblyStale={summary.locationsArePossiblyStale}
          isLoadingLocations={state.locationsQuery.isLoading}
          selectedLocation={state.selectedLocation}
          selectedLocationValue={state.selectedLocationValue}
          onSelectedLocationValueChange={state.setSelectedLocationValue}
          hasLinkedLocation={summary.hasLinkedLocation}
          onLinkLocation={state.handleLinkLocation}
          isLinking={state.linkMutation.isPending}
          linkErrorMessage={
            state.persistentError?.kind === 'link' ? state.persistentError.message : null
          }
        />
      ) : null}
      <GoogleBusinessProfileDisconnectDialog
        open={state.disconnectDialogOpen}
        isPending={state.disconnectMutation.isPending}
        onOpenChange={state.handleDisconnectDialogOpenChange}
        onConfirm={state.handleConfirmDisconnect}
      />
    </>
  );
}
