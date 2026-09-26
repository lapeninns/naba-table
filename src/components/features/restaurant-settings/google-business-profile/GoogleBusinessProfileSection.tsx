'use client';

import { useOpsSession } from '@/contexts/ops-session';

import { RESTAURANT_SETTINGS_ROUTE_MAP } from '../routes';
import { RestaurantSettingsCommandCenter, SettingsSectionStates } from '../shared';
import { SettingsRefreshErrorAlert } from '../shared/SettingsRefreshErrorAlert';
import { GbpLinkedView } from './components/GbpLinkedView';
import { GbpLocationChooserDialog } from './components/GbpLocationChooserDialog';
import { GbpSetupCard } from './components/GbpSetupCard';
import {
  EmptyGbpConnectionSection,
  ErrorGbpSection,
  GoogleBusinessProfileDisconnectDialog,
  LoadingGbpSection,
  NoRestaurantGbpSection,
  PersistentGbpErrorAlert,
} from './sections';
import { useGoogleBusinessProfileSectionState } from './useGoogleBusinessProfileSectionState';

const ROUTE = RESTAURANT_SETTINGS_ROUTE_MAP['google-business-profile'];

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
};

/**
 * Google Business Profile settings. Until a listing is linked: the three setup steps. Once
 * linked: the listing overview, anything limiting publishing, and the Review differences and
 * Operations tabs.
 */
export function GoogleBusinessProfileSection({ restaurantId }: GoogleBusinessProfileSectionProps) {
  const { permissions } = useOpsSession();
  const state = useGoogleBusinessProfileSectionState({ restaurantId });
  const { summary } = state;
  const canManageSettings = permissions.canManageSettings;
  // Linked, or linked with Google access expired (the last comparison stays readable).
  const showLinkedView =
    summary.hasLinkedLocation && (summary.isLinked || summary.status === 'reauth_required');

  return (
    <>
      <RestaurantSettingsCommandCenter
        title={ROUTE.title}
        description={ROUTE.description}
        // The setup card and the overview explain the page once it loads.
        showHeader={!state.data}
      >
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

                {showLinkedView ? (
                  <GbpLinkedView
                    restaurantId={restaurantId}
                    section={state}
                    canManageSettings={canManageSettings}
                  />
                ) : (
                  <GbpSetupCard
                    data={state.data}
                    accountLabel={summary.accountLabel}
                    connectError={summary.isLinked ? null : state.data.lastError}
                    onConnect={state.handleConnectGoogle}
                    isConnecting={state.startAuthorizationMutation.isPending}
                    onChooseLocation={() => state.setLocationChooserOpen(true)}
                    locationsErrorMessage={summary.locationsErrorMessage}
                    onRetryLocations={() => void state.locationsQuery.refetch()}
                    isRetryingLocations={state.locationsQuery.isFetching}
                    onRequestDisconnect={
                      summary.canDisconnect ? state.handleRequestDisconnect : null
                    }
                  />
                )}
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
