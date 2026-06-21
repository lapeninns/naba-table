'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  useOpsDisconnectGoogleBusinessProfile,
  useOpsGoogleBusinessProfileAvailableLocations,
  useOpsGoogleBusinessProfileConnection,
  useOpsLinkGoogleBusinessProfileLocation,
  useOpsStartGoogleBusinessProfileAuthorization,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { invalidateOpsIntegrationQueries } from '@src/hooks/ops/opsIntegrationQueries';

import {
  deriveGoogleBusinessProfileSectionSummary,
  findGoogleBusinessProfileSelectedLocation,
  mergeGoogleBusinessProfileConnectionData,
  resolveGoogleBusinessProfileSelectedLocationValue,
} from './googleBusinessProfileSectionStateDomain';
import { useGoogleBusinessProfileCallbackStatus } from './useGoogleBusinessProfileCallbackStatus';
import { useGoogleBusinessProfileSectionNavigation } from './useGoogleBusinessProfileSectionNavigation';
import { useOptionalGbpDrift } from '../gbp-drift/useGbpDrift';

import type { PersistentGbpError } from './googleBusinessProfileWorkflow';
import type { GoogleBusinessProfileOverviewPanelProps } from './sections';

type UseGoogleBusinessProfileSectionStateOptions = {
  restaurantId: string | null;
  hasSyncWorkspace: boolean;
};

export function useGoogleBusinessProfileSectionState({
  restaurantId,
  hasSyncWorkspace,
}: UseGoogleBusinessProfileSectionStateOptions) {
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

  useGoogleBusinessProfileCallbackStatus({
    searchParams,
    setPersistentError,
  });
  const { chooseLocationAnchor, selectAnchor } = useGoogleBusinessProfileSectionNavigation({
    hasSyncWorkspace,
  });

  const data = useMemo(
    () =>
      mergeGoogleBusinessProfileConnectionData({
        availableLocations: locationsQuery.data,
        connectionData,
      }),
    [connectionData, locationsQuery.data],
  );

  useEffect(() => {
    const nextSelectedLocationValue = resolveGoogleBusinessProfileSelectedLocationValue({
      data,
      selectedLocationValue,
    });
    if (nextSelectedLocationValue) {
      setSelectedLocationValue(nextSelectedLocationValue);
    }
  }, [data, selectedLocationValue]);

  const selectedLocation = useMemo(
    () => findGoogleBusinessProfileSelectedLocation({ data, selectedLocationValue }),
    [data, selectedLocationValue],
  );

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

  const handleConfirmDisconnect = useCallback(
    (password: string) => {
      if (disconnectMutation.isPending) {
        return;
      }
      disconnectMutation.mutate(
        { password },
        {
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
        },
      );
    },
    [disconnectMutation],
  );

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

  const handleDisconnectDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disconnectMutation.isPending) {
        return;
      }
      setDisconnectDialogOpen(nextOpen);
    },
    [disconnectMutation.isPending],
  );

  const gbpDrift = useOptionalGbpDrift();
  const summary = useMemo(
    () =>
      deriveGoogleBusinessProfileSectionSummary({
        data,
        locationsError: locationsQuery.error,
      }),
    [data, locationsQuery.error],
  );

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

  const overviewProps: GoogleBusinessProfileOverviewPanelProps = {
    status: summary.status,
    stageLabel: summary.stageLabel,
    locationTitle: summary.locationTitle,
    accountLabel: summary.accountLabel,
    lastPullAt: data?.lastPullAt ?? null,
    hasLinkedLocation: summary.hasLinkedLocation,
    showConnect: summary.showConnect && Boolean(restaurantId),
    onConnect: restaurantId ? handleConnectGoogle : null,
    isConnecting: startAuthorizationMutation.isPending,
    showPicker: summary.showPicker,
    onChooseLocation: chooseLocationAnchor,
    canRefresh: summary.canRefresh,
    onRefresh: summary.canRefresh ? refreshHandler : null,
    isRefreshing: connectionQuery.isFetching,
    manageOnGoogleHref: summary.manageOnGoogleHref,
    canDisconnect: summary.canDisconnect,
    onRequestDisconnect: summary.canDisconnect ? handleRequestDisconnect : null,
    isDisconnecting: disconnectMutation.isPending,
    error: persistentError,
    errorAction: persistentErrorAction,
  };

  return {
    connectionQuery,
    data,
    disconnectDialogOpen,
    disconnectMutation,
    gbpDrift,
    handleConfirmDisconnect,
    handleConnectGoogle,
    handleDisconnectDialogOpenChange,
    handleLinkLocation,
    hasLinkedLocation: summary.hasLinkedLocation,
    isLinked: summary.isLinked,
    linkMutation,
    locationsArePossiblyStale: summary.locationsArePossiblyStale,
    locationsErrorMessage: summary.locationsErrorMessage,
    locationsQuery,
    overviewProps,
    selectedLocation,
    selectedLocationValue,
    selectAnchor,
    setSelectedLocationValue,
    showConnect: summary.showConnect,
    showPicker: summary.showPicker,
    stage: summary.stage,
    startAuthorizationMutation,
  };
}

export type GoogleBusinessProfileSectionState = ReturnType<
  typeof useGoogleBusinessProfileSectionState
>;
