'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import {
  useOpsDisconnectGoogleBusinessProfile,
  useOpsGoogleBusinessProfileAvailableLocations,
  useOpsGoogleBusinessProfileConnection,
  useOpsLinkGoogleBusinessProfileLocation,
  useOpsStartGoogleBusinessProfileAuthorization,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { type GoogleBusinessProfileAvailableLocation } from '@/services/ops/restaurants';
import { invalidateOpsIntegrationQueries } from '@src/hooks/ops/opsIntegrationQueries';

import { useOptionalGbpDrift } from '../gbp-drift/useGbpDrift';
import { SettingsSectionStates } from '../shared';
import { GbpOverviewCard } from './components/GbpOverviewCard';
import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from './googleBusinessProfileConnectionModel';
import {
  getConnectedAccountLabel,
  getLocationTitle,
  getStage,
  getStageLabel,
  isGbpAnchorId,
  type GbpAnchorId,
  type PersistentGbpError,
} from './googleBusinessProfileWorkflow';
import {
  EmptyGbpConnectionSection,
  ErrorGbpSection,
  GbpConnectionSection,
  GbpLocationPickerSection,
  GbpSyncSummarySection,
  GbpWorkflowFrame,
  LoadingGbpSection,
  NoRestaurantGbpSection,
  PersistentGbpErrorAlert,
} from './sections';

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
  hasSyncWorkspace?: boolean;
};

export function GoogleBusinessProfileSection({
  restaurantId,
  hasSyncWorkspace = true,
}: GoogleBusinessProfileSectionProps) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const connectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const connectionData = connectionQuery.data;
  const shouldLoadLocations =
    connectionData?.status === 'authorized' || connectionData?.status === 'reauth_required';
  const locationsQuery = useOpsGoogleBusinessProfileAvailableLocations(
    restaurantId,
    shouldLoadLocations,
  );
  const linkMutation = useOpsLinkGoogleBusinessProfileLocation(restaurantId);
  const disconnectMutation = useOpsDisconnectGoogleBusinessProfile(restaurantId);
  const startAuthorizationMutation = useOpsStartGoogleBusinessProfileAuthorization(restaurantId);

  const [selectedLocationValue, setSelectedLocationValue] = useState('');
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [persistentError, setPersistentError] = useState<PersistentGbpError | null>(null);

  useEffect(() => {
    const gbpStatus = searchParams.get('gbp');
    const message = searchParams.get('message');
    if (!gbpStatus) {
      return;
    }

    if (gbpStatus === 'connected') {
      setPersistentError(null);
      toast.success('Google Business Profile connected. Choose a location to finish linking.');
    } else if (gbpStatus === 'error') {
      const errorMessage = message ?? 'Google Business Profile connection failed.';
      setPersistentError({
        kind: 'callback',
        title: 'Google connection failed',
        message: errorMessage,
      });
      toast.error(errorMessage);
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('gbp');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.slice(1);
      if (!raw || !isGbpAnchorId(raw)) {
        return;
      }
      if (raw === 'gbp-sync-review' && !hasSyncWorkspace) {
        return;
      }
      requestAnimationFrame(() => {
        document.getElementById(raw)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [hasSyncWorkspace]);

  const data = useMemo(
    () =>
      connectionData
        ? {
            ...connectionData,
            availableLocations: locationsQuery.data ?? connectionData.availableLocations,
          }
        : undefined,
    [connectionData, locationsQuery.data],
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.externalLocationName && data.externalAccountName) {
      const linkedLocation = data.availableLocations.find(
        (location) =>
          location.locationName === data.externalLocationName &&
          location.accountName === data.externalAccountName,
      );
      if (linkedLocation) {
        setSelectedLocationValue(buildLocationValue(linkedLocation));
        return;
      }
    }

    if (!selectedLocationValue && data.availableLocations[0]) {
      setSelectedLocationValue(buildLocationValue(data.availableLocations[0]));
    }
  }, [data, selectedLocationValue]);

  const selectedLocation = useMemo<GoogleBusinessProfileAvailableLocation | null>(() => {
    if (!data) {
      return null;
    }

    return (
      data.availableLocations.find(
        (location) => buildLocationValue(location) === selectedLocationValue,
      ) ?? null
    );
  }, [data, selectedLocationValue]);

  const refreshHandler = useCallback(() => {
    setPersistentError(null);
    if (restaurantId) {
      invalidateOpsIntegrationQueries(queryClient, restaurantId);
    }
    void connectionQuery.refetch();
    if (shouldLoadLocations) {
      void locationsQuery.refetch();
    }
  }, [connectionQuery, locationsQuery, queryClient, restaurantId, shouldLoadLocations]);

  const handleRequestDisconnect = useCallback(() => {
    setDisconnectDialogOpen(true);
  }, []);

  const handleConfirmDisconnect = useCallback(() => {
    if (disconnectMutation.isPending) {
      return;
    }
    disconnectMutation.mutate(undefined, {
      onSuccess: () => {
        setSelectedLocationValue('');
        setDisconnectDialogOpen(false);
        setPersistentError(null);
        toast.success('Google Business Profile disconnected.');
      },
      onError: (error) => {
        setPersistentError({
          kind: 'disconnect',
          title: 'Disconnect failed',
          message: error.message,
        });
        toast.error(error.message);
      },
    });
  }, [disconnectMutation]);

  const handleLinkLocation = useCallback(() => {
    if (!selectedLocation) {
      toast.error('Choose a location before linking.');
      return;
    }

    linkMutation.mutate(
      {
        accountName: selectedLocation.accountName,
        accountId: selectedLocation.accountId,
        locationName: selectedLocation.locationName,
        locationId: selectedLocation.locationId,
      },
      {
        onSuccess: () => {
          setPersistentError(null);
          toast.success('Google Business Profile location linked.');
        },
        onError: (error) => {
          setPersistentError({
            kind: 'link',
            title: 'Location link failed',
            message: error.message,
          });
          toast.error(error.message);
        },
      },
    );
  }, [linkMutation, selectedLocation]);

  const handleConnectGoogle = useCallback(() => {
    if (startAuthorizationMutation.isPending) {
      return;
    }

    startAuthorizationMutation.mutate(undefined, {
      onSuccess: ({ authorizationUrl }) => {
        setPersistentError(null);
        window.location.assign(authorizationUrl);
      },
      onError: (error) => {
        setPersistentError({
          kind: 'authorization',
          title: 'Google authorization failed',
          message: error.message,
        });
        toast.error(error.message);
      },
    });
  }, [startAuthorizationMutation]);

  const selectAnchor = useCallback(
    (anchorId: GbpAnchorId) => {
      if (anchorId === 'gbp-sync-review' && !hasSyncWorkspace) {
        return;
      }
      window.history.replaceState(null, '', `#${anchorId}`);
      requestAnimationFrame(() => {
        document.getElementById(anchorId)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    },
    [hasSyncWorkspace],
  );

  const stage = getStage(data);
  const manageOnGoogleHref = buildGoogleMapsPlaceHref(data?.externalPlaceId ?? null);
  const hasLinkedLocation = Boolean(data?.externalLocationId);
  const isLinked = data?.status === 'linked' || data?.status === 'sync_error';
  const gbpDrift = useOptionalGbpDrift();
  const showPicker = data?.status === 'authorized' || data?.status === 'reauth_required';
  const showConnect = !isLinked && !showPicker && data?.status !== 'authorized';
  const canRefresh = Boolean(data && data.status !== 'unlinked');
  const canDisconnect = Boolean(data && data.status !== 'unlinked');
  const accountLabel = getConnectedAccountLabel(data ?? null);
  const status = data?.status ?? 'unlinked';
  const locationsErrorMessage = locationsQuery.error?.message ?? null;
  const locationsArePossiblyStale =
    Boolean(locationsQuery.error) && Boolean(data?.availableLocations.length);
  const persistentErrorAction = useMemo(() => {
    if (!persistentError) {
      return null;
    }

    if (persistentError.kind === 'link' && selectedLocation) {
      return {
        label: 'Retry link',
        onAction: handleLinkLocation,
        isPending: linkMutation.isPending,
      };
    }

    if (persistentError.kind === 'authorization' || persistentError.kind === 'callback') {
      return {
        label: 'Retry connect',
        onAction: handleConnectGoogle,
        isPending: startAuthorizationMutation.isPending,
      };
    }

    return {
      label: 'Refresh connection',
      onAction: refreshHandler,
      isPending: connectionQuery.isFetching,
    };
  }, [
    connectionQuery.isFetching,
    handleConnectGoogle,
    handleLinkLocation,
    linkMutation.isPending,
    persistentError,
    refreshHandler,
    selectedLocation,
    startAuthorizationMutation.isPending,
  ]);

  const overview = (
    <div className="flex min-w-0 flex-col gap-3">
      {persistentError ? (
        <PersistentGbpErrorAlert
          error={persistentError}
          actionLabel={persistentErrorAction?.label}
          onAction={persistentErrorAction?.onAction}
          isActionPending={persistentErrorAction?.isPending}
        />
      ) : null}
      <GbpOverviewCard
        status={status}
        stageLabel={getStageLabel(stage)}
        locationTitle={getLocationTitle(data ?? null)}
        accountLabel={accountLabel}
        lastPullAt={data?.lastPullAt ?? null}
        hasLinkedLocation={hasLinkedLocation}
        showConnect={showConnect && Boolean(restaurantId)}
        onConnect={restaurantId ? handleConnectGoogle : null}
        isConnecting={startAuthorizationMutation.isPending}
        showPicker={showPicker}
        onChooseLocation={() => selectAnchor('gbp-location')}
        canRefresh={canRefresh}
        onRefresh={canRefresh ? refreshHandler : null}
        isRefreshing={connectionQuery.isFetching}
        manageOnGoogleHref={manageOnGoogleHref}
        canDisconnect={canDisconnect}
        onRequestDisconnect={canDisconnect ? handleRequestDisconnect : null}
        isDisconnecting={disconnectMutation.isPending}
      />
    </div>
  );

  const frameProps = {
    data: data ?? null,
    stage,
    overview,
    hasSyncWorkspace,
    onSelectAnchor: selectAnchor,
  };

  const disconnectDialog = (
    <AlertDialog
      open={disconnectDialogOpen}
      onOpenChange={(nextOpen) => {
        if (disconnectMutation.isPending) {
          return;
        }
        setDisconnectDialogOpen(nextOpen);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Google Business Profile?</AlertDialogTitle>
          <AlertDialogDescription>
            This restaurant will be unlinked from Google. Sync and review tools will stop using the
            current listing until Google is reconnected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disconnectMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            disabled={disconnectMutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              handleConfirmDisconnect();
            }}
          >
            {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <>
      <GbpWorkflowFrame {...frameProps}>
        <SettingsSectionStates
          restaurantId={restaurantId}
          isLoading={connectionQuery.isLoading && !data}
          error={connectionQuery.error}
          noRestaurant={<NoRestaurantGbpSection />}
          loading={<LoadingGbpSection />}
          errorState={(error) => (
            <ErrorGbpSection error={error} onRetry={() => void connectionQuery.refetch()} />
          )}
        >
          {() =>
            data ? (
              <>
                {showConnect ? (
                  <GbpConnectionSection
                    onConnect={handleConnectGoogle}
                    isConfigured={data.isConfigured}
                    isConnecting={startAuthorizationMutation.isPending}
                    isPendingAuth={data.status === 'pending_auth'}
                    lastError={!isLinked ? data.lastError : null}
                  />
                ) : null}

                {showPicker ? (
                  <GbpLocationPickerSection
                    data={data}
                    onConnect={handleConnectGoogle}
                    isConnecting={startAuthorizationMutation.isPending}
                    selectedLocation={selectedLocation}
                    selectedLocationValue={selectedLocationValue}
                    onSelectedLocationValueChange={setSelectedLocationValue}
                    onLinkLocation={handleLinkLocation}
                    isLinking={linkMutation.isPending}
                    hasLinkedLocation={hasLinkedLocation}
                    locationsErrorMessage={locationsErrorMessage}
                    onRetryLocations={() => void locationsQuery.refetch()}
                    isRetryingLocations={locationsQuery.isFetching}
                    locationsArePossiblyStale={locationsArePossiblyStale}
                  />
                ) : null}

                {isLinked ? (
                  <GbpSyncSummarySection
                    status={data.status === 'sync_error' ? 'sync_error' : 'linked'}
                    lastError={data.lastError}
                    hasSyncWorkspace={hasSyncWorkspace}
                    gbpDrift={gbpDrift}
                  />
                ) : null}
              </>
            ) : (
              <EmptyGbpConnectionSection />
            )
          }
        </SettingsSectionStates>
      </GbpWorkflowFrame>
      {disconnectDialog}
    </>
  );
}
