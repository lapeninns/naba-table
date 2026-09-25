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
  describeGoogleBusinessProfileLinkedLocation,
  findGoogleBusinessProfileSelectedLocation,
  mergeGoogleBusinessProfileConnectionData,
  resolveGoogleBusinessProfileSelectedLocationValue,
} from './googleBusinessProfileSectionStateDomain';
import { useGoogleBusinessProfileCallbackStatus } from './useGoogleBusinessProfileCallbackStatus';
import { useGoogleBusinessProfileSectionNavigation } from './useGoogleBusinessProfileSectionNavigation';

import type { PersistentGbpError } from './googleBusinessProfileWorkflow';

type UseGoogleBusinessProfileSectionStateOptions = {
  restaurantId: string | null;
};

export function useGoogleBusinessProfileSectionState({
  restaurantId,
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
  const [locationChooserOpen, setLocationChooserOpen] = useState(false);
  const [persistentError, setPersistentError] = useState<PersistentGbpError | null>(null);

  useGoogleBusinessProfileCallbackStatus({
    searchParams,
    setPersistentError,
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
          setLocationChooserOpen(false);
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

  const summary = useMemo(
    () =>
      deriveGoogleBusinessProfileSectionSummary({
        data,
        locationsError: locationsQuery.error,
      }),
    [data, locationsQuery.error],
  );

  useGoogleBusinessProfileSectionNavigation({
    canReview: summary.canReview,
    ready: Boolean(data),
  });

  const linkedLocation = useMemo(
    () =>
      data && summary.hasLinkedLocation ? describeGoogleBusinessProfileLinkedLocation(data) : null,
    [data, summary.hasLinkedLocation],
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
      label: 'Check again',
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

  return {
    connectionQuery,
    data,
    disconnectDialogOpen,
    disconnectMutation,
    handleConfirmDisconnect,
    handleConnectGoogle,
    handleDisconnectDialogOpenChange,
    handleLinkLocation,
    handleRequestDisconnect,
    linkedLocation,
    linkMutation,
    locationChooserOpen,
    locationsQuery,
    persistentError,
    persistentErrorAction,
    refreshHandler,
    selectedLocation,
    selectedLocationValue,
    setLocationChooserOpen,
    setSelectedLocationValue,
    startAuthorizationMutation,
    summary,
  };
}

export type GoogleBusinessProfileSectionState = ReturnType<
  typeof useGoogleBusinessProfileSectionState
>;
