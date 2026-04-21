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
  useOpsSyncGoogleBusinessProfile,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import {
  OPS_RESTAURANTS_BASE,
  type GoogleBusinessProfileAvailableLocation,
  type GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

import { AlignmentCard } from './components/AlignmentCard';
import { ConnectCard } from './components/ConnectCard';
import { LinkedSummaryCard } from './components/LinkedSummaryCard';
import { LocationPickerCard } from './components/LocationPickerCard';
import { PageHeader } from './components/PageHeader';
import { SnapshotCard } from './components/SnapshotCard';
import { GoogleBusinessProfileSyncActionDialog } from './GoogleBusinessProfileSyncActionDialog';
import { deriveProfileVerification } from './googleBusinessProfileVerification';
import { buildDriftReport } from './lib/drift';

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
};

function buildLocationValue(location: GoogleBusinessProfileAvailableLocation): string {
  return JSON.stringify({
    accountName: location.accountName,
    accountId: location.accountId,
    locationName: location.locationName,
    locationId: location.locationId,
  });
}

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
  const profileQuery = useOpsRestaurantDetails(restaurantId);
  const operatingHoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const linkMutation = useOpsLinkGoogleBusinessProfileLocation(restaurantId);
  const disconnectMutation = useOpsDisconnectGoogleBusinessProfile(restaurantId);
  const syncMutation = useOpsSyncGoogleBusinessProfile(restaurantId);

  const [selectedLocationValue, setSelectedLocationValue] = useState('');
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [wantsRelink, setWantsRelink] = useState(false);

  useEffect(() => {
    const gbpStatus = searchParams.get('gbp');
    const message = searchParams.get('message');
    if (!gbpStatus) return;

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
    if (!data) return;

    if (data.externalLocationName && data.externalAccountName && !wantsRelink) {
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
  }, [data, selectedLocationValue, wantsRelink]);

  const selectedLocation = useMemo<GoogleBusinessProfileAvailableLocation | null>(() => {
    if (!data) return null;
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
  const manageOnGoogleHref = data.externalPlaceId
    ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(data.externalPlaceId)}`
    : null;
  const hasLinkedLocation = Boolean(data.externalLocationId);
  const isLinked = data.status === 'linked' || data.status === 'sync_error';

  const showPicker =
    data.status === 'authorized' ||
    data.status === 'reauth_required' ||
    (isLinked && wantsRelink);

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
          setWantsRelink(false);
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
        setWantsRelink(false);
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
          buildLocationValue={buildLocationValue}
          onLinkLocation={handleLinkLocation}
          isLinking={linkMutation.isPending}
          hasLinkedLocation={hasLinkedLocation}
        />
      ) : null}

      {isLinked ? (
        <>
          <LinkedSummaryCard
            data={data}
            manageOnGoogleHref={manageOnGoogleHref}
            onSyncNow={() => setSyncDialogOpen(true)}
            onChangeLocation={() => setWantsRelink(true)}
            isSyncing={syncMutation.isPending}
          />
          <AlignmentCard
            report={buildDriftReport({
              profile: profileQuery.data,
              connection: data,
              verification: deriveProfileVerification({
                profile: profileQuery.data,
                connection: data,
              }),
            })}
            connection={data}
            operatingHours={operatingHoursQuery.data}
            servicePeriods={servicePeriodsQuery.data}
            isScheduleDataLoading={
              (operatingHoursQuery.isLoading && !operatingHoursQuery.data) ||
              (servicePeriodsQuery.isLoading && !servicePeriodsQuery.data)
            }
          />
          <SnapshotCard businessInfo={data.businessInfo} />
        </>
      ) : null}

      <GoogleBusinessProfileSyncActionDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        title="Fetch latest GBP business information"
        description="Refresh Nabatable's canonical GBP business-information snapshot. This updates the fetched GBP data and verification metadata, but it does not overwrite core profile, hours, or service-period values."
        confirmLabel="Fetch from GBP"
        isPending={syncMutation.isPending}
        errorMessage={syncMutation.error?.message ?? null}
        onConfirm={({ password }) => {
          syncMutation.mutate(
            { password },
            {
              onSuccess: (state: GoogleBusinessProfileConnection) => {
                setSyncDialogOpen(false);
                const warning = state.lastError;
                if (warning) {
                  toast.success('Business information synced, with a partial warning.');
                  toast.warning(warning);
                  return;
                }
                toast.success('Google Business Profile business information synced.');
              },
              onError: (error) => toast.error(error.message),
            },
          );
        }}
      />
    </div>
  );
}
