'use client';

import { SettingsSectionStates } from '../shared';
import {
  EmptyGbpConnectionSection,
  ErrorGbpSection,
  GbpConnectionSection,
  GoogleBusinessProfileDisconnectDialog,
  GoogleBusinessProfileOverviewPanel,
  GbpLocationPickerSection,
  GbpSyncSummarySection,
  GbpWorkflowFrame,
  LoadingGbpSection,
  NoRestaurantGbpSection,
} from './sections';
import { useGoogleBusinessProfileSectionState } from './useGoogleBusinessProfileSectionState';

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
  hasSyncWorkspace?: boolean;
};

export function GoogleBusinessProfileSection({
  restaurantId,
  hasSyncWorkspace = true,
}: GoogleBusinessProfileSectionProps) {
  const state = useGoogleBusinessProfileSectionState({
    restaurantId,
    hasSyncWorkspace,
  });
  const overview = <GoogleBusinessProfileOverviewPanel {...state.overviewProps} />;

  return (
    <>
      <GbpWorkflowFrame
        data={state.data ?? null}
        stage={state.stage}
        overview={overview}
        hasSyncWorkspace={hasSyncWorkspace}
        onSelectAnchor={state.selectAnchor}
      >
        <SettingsSectionStates
          restaurantId={restaurantId}
          isLoading={state.connectionQuery.isLoading && !state.data}
          error={state.connectionQuery.error}
          noRestaurant={<NoRestaurantGbpSection />}
          loading={<LoadingGbpSection />}
          errorState={(error) => (
            <ErrorGbpSection error={error} onRetry={() => void state.connectionQuery.refetch()} />
          )}
        >
          {() =>
            state.data ? (
              <>
                {state.showConnect ? (
                  <GbpConnectionSection
                    onConnect={state.handleConnectGoogle}
                    isConfigured={state.data.isConfigured}
                    isConnecting={state.startAuthorizationMutation.isPending}
                    isPendingAuth={state.data.status === 'pending_auth'}
                    lastError={!state.isLinked ? state.data.lastError : null}
                  />
                ) : null}

                {state.showPicker ? (
                  <GbpLocationPickerSection
                    data={state.data}
                    onConnect={state.handleConnectGoogle}
                    isConnecting={state.startAuthorizationMutation.isPending}
                    selectedLocation={state.selectedLocation}
                    selectedLocationValue={state.selectedLocationValue}
                    onSelectedLocationValueChange={state.setSelectedLocationValue}
                    onLinkLocation={state.handleLinkLocation}
                    isLinking={state.linkMutation.isPending}
                    hasLinkedLocation={state.hasLinkedLocation}
                    locationsErrorMessage={state.locationsErrorMessage}
                    onRetryLocations={() => void state.locationsQuery.refetch()}
                    isRetryingLocations={state.locationsQuery.isFetching}
                    locationsArePossiblyStale={state.locationsArePossiblyStale}
                  />
                ) : null}

                {state.isLinked ? (
                  <GbpSyncSummarySection
                    status={state.data.status === 'sync_error' ? 'sync_error' : 'linked'}
                    lastError={state.data.lastError}
                    hasSyncWorkspace={hasSyncWorkspace}
                    gbpDrift={state.gbpDrift}
                  />
                ) : null}
              </>
            ) : (
              <EmptyGbpConnectionSection />
            )
          }
        </SettingsSectionStates>
      </GbpWorkflowFrame>
      <GoogleBusinessProfileDisconnectDialog
        open={state.disconnectDialogOpen}
        isPending={state.disconnectMutation.isPending}
        onOpenChange={state.handleDisconnectDialogOpenChange}
        onConfirm={state.handleConfirmDisconnect}
      />
    </>
  );
}
