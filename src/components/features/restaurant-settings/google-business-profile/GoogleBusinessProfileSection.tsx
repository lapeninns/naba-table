'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOpsDisconnectGoogleBusinessProfile,
  useOpsGoogleBusinessProfileConnection,
  useOpsLinkGoogleBusinessProfileLocation,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import {
  OPS_RESTAURANTS_BASE,
  type GoogleBusinessProfileAvailableLocation,
} from '@/services/ops/restaurants';

import { AlignmentCard } from './components/AlignmentCard';
import { ConnectCard } from './components/ConnectCard';
import { LinkedSummaryCard } from './components/LinkedSummaryCard';
import { LocationPickerCard } from './components/LocationPickerCard';
import { PageHeader } from './components/PageHeader';
import { SnapshotCard } from './components/SnapshotCard';
import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from './googleBusinessProfileConnectionModel';
import { deriveProfileVerification } from './googleBusinessProfileVerification';
import { buildDriftReport } from './lib/drift';

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
  const profileQuery = useOpsRestaurantDetails(restaurantId);
  const operatingHoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const linkMutation = useOpsLinkGoogleBusinessProfileLocation(restaurantId);
  const disconnectMutation = useOpsDisconnectGoogleBusinessProfile(restaurantId);

  const [selectedLocationValue, setSelectedLocationValue] = useState('');
  const [wantsRelink, setWantsRelink] = useState(false);

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
  const showPicker =
    data.status === 'authorized' || data.status === 'reauth_required' || (isLinked && wantsRelink);
  const showConnect = !isLinked && !showPicker && data.status !== 'authorized';
  const profileVerification = profileQuery.data
    ? deriveProfileVerification({ profile: profileQuery.data, connection: data })
    : null;
  const driftReport =
    profileQuery.data && profileVerification
      ? buildDriftReport({
          profile: profileQuery.data,
          connection: data,
          verification: profileVerification,
        })
      : null;

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

      {isLinked ? (
        <section className="space-y-4" data-testid="gbp-secondary-analysis">
          <Card>
            <CardHeader>
              <CardTitle>Secondary analysis</CardTitle>
              <CardDescription>
                Review the linked Google location, cached snapshot, and read-only drift signals
                before changing any local restaurant settings.
              </CardDescription>
            </CardHeader>
          </Card>

          <LinkedSummaryCard
            data={data}
            manageOnGoogleHref={manageOnGoogleHref}
            onGenerateDraft={() => void connectionQuery.refetch()}
            onChangeLocation={() => setWantsRelink(true)}
            isGeneratingDraft={connectionQuery.isFetching}
          />

          {profileQuery.isLoading && !profileQuery.data ? (
            <Card>
              <CardContent className="space-y-3 py-6">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ) : driftReport ? (
            <AlignmentCard
              report={driftReport}
              connection={data}
              operatingHours={operatingHoursQuery.data}
              servicePeriods={servicePeriodsQuery.data}
              isScheduleDataLoading={operatingHoursQuery.isLoading || servicePeriodsQuery.isLoading}
            />
          ) : null}

          <SnapshotCard businessInfo={data.businessInfo} />
        </section>
      ) : null}
    </div>
  );
}
