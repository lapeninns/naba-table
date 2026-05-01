'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOpsDisconnectGoogleBusinessProfile,
  useOpsGoogleBusinessProfileConnection,
  useOpsLinkGoogleBusinessProfileLocation,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import {
  OPS_RESTAURANTS_BASE,
  type GoogleBusinessProfileAvailableLocation,
} from '@/services/ops/restaurants';

import { ConnectCard } from './components/ConnectCard';
import { LocationPickerCard } from './components/LocationPickerCard';
import { PageHeader } from './components/PageHeader';
import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from './googleBusinessProfileConnectionModel';

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

export function GoogleBusinessProfileSection({ restaurantId }: GoogleBusinessProfileSectionProps) {
  const searchParams = useSearchParams();
  const connectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const linkMutation = useOpsLinkGoogleBusinessProfileLocation(restaurantId);
  const disconnectMutation = useOpsDisconnectGoogleBusinessProfile(restaurantId);

  const [selectedLocationValue, setSelectedLocationValue] = useState('');

  useEffect(() => {
    const gbpStatus = searchParams.get('gbp');
    const message = searchParams.get('message');
    if (!gbpStatus) {
      return;
    }

    if (gbpStatus === 'connected') {
      toast.success('Google Business Profile connected. Choose a location to finish linking.');
    } else if (gbpStatus === 'error') {
      toast.error(message ?? 'Google Business Profile connection failed.');
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('gbp');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const data = connectionQuery.data;

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

  if (!restaurantId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Select a restaurant using the sidebar switcher to manage its Google Business Profile
          connection.
        </CardContent>
      </Card>
    );
  }

  if (connectionQuery.isLoading && !data) {
    return <LoadingSkeleton />;
  }

  if (connectionQuery.error) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertTitle>Unable to load Google Business Profile</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{connectionQuery.error.message}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void connectionQuery.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const connectHref = `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/connect`;
  const manageOnGoogleHref = buildGoogleMapsPlaceHref(data.externalPlaceId);
  const hasLinkedLocation = Boolean(data.externalLocationId);
  const isLinked = data.status === 'linked' || data.status === 'sync_error';
  const showPicker = data.status === 'authorized' || data.status === 'reauth_required';
  const showConnect = !isLinked && !showPicker && data.status !== 'authorized';

  const handleLinkLocation = () => {
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
          toast.success('Google Business Profile location linked.');
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => {
        setSelectedLocationValue('');
        toast.success('Google Business Profile disconnected.');
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        status={data.status}
        lastPullAt={data.lastPullAt}
        providerTimezone={data.providerTimezone}
        onRefresh={() => void connectionQuery.refetch()}
        isRefreshing={connectionQuery.isFetching}
        manageOnGoogleHref={manageOnGoogleHref}
        canDisconnect={data.status !== 'unlinked'}
        onDisconnect={handleDisconnect}
        isDisconnecting={disconnectMutation.isPending}
      />

      {showConnect ? (
        <ConnectCard
          connectHref={connectHref}
          isConfigured={data.isConfigured}
          isPendingAuth={data.status === 'pending_auth'}
          lastError={!isLinked ? data.lastError : null}
        />
      ) : null}

      {showPicker ? (
        <LocationPickerCard
          data={data}
          connectHref={connectHref}
          selectedLocation={selectedLocation}
          selectedLocationValue={selectedLocationValue}
          onSelectedLocationValueChange={setSelectedLocationValue}
          onLinkLocation={handleLinkLocation}
          isLinking={linkMutation.isPending}
          hasLinkedLocation={hasLinkedLocation}
        />
      ) : null}

    </div>
  );
}
