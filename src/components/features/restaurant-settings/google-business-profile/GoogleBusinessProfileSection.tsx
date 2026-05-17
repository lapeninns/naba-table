'use client';

import { useQueryClient } from '@tanstack/react-query';
import { MapPin, SearchCheck, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOpsDisconnectGoogleBusinessProfile,
  useOpsGoogleBusinessProfileAvailableLocations,
  useOpsGoogleBusinessProfileConnection,
  useOpsLinkGoogleBusinessProfileLocation,
  useOpsStartGoogleBusinessProfileAuthorization,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { opsHref } from '@/lib/url/opsHref';
import {
  type GoogleBusinessProfileAvailableLocation,
  type GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';
import { invalidateOpsIntegrationQueries } from '@src/hooks/ops/opsIntegrationQueries';

import { RestaurantSettingsCommandCenter, type RestaurantSettingsCommandRailItem } from '../shared';
import { ConnectCard } from './components/ConnectCard';
import { GbpOverviewCard } from './components/GbpOverviewCard';
import { LocationPickerCard } from './components/LocationPickerCard';
import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from './googleBusinessProfileConnectionModel';

import type { ReactNode } from 'react';

const GBP_ANCHOR_IDS = ['gbp-connection', 'gbp-location', 'gbp-sync-review'] as const;

type GbpAnchorId = (typeof GBP_ANCHOR_IDS)[number];
type GbpWorkflowStage = 'connect' | 'location' | 'linked' | 'issue';
type GbpStepStatus = 'complete' | 'active' | 'blocked' | 'pending';

const GBP_ANCHOR_ID_SET = new Set<string>(GBP_ANCHOR_IDS);

function isGbpAnchorId(value: string): value is GbpAnchorId {
  return GBP_ANCHOR_ID_SET.has(value);
}

const PROFILE_DISCOVERY_HREF = opsHref('/settings/restaurant/profile#profile-discovery');
const AVAILABILITY_HREF = opsHref('/settings/restaurant/availability');

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
  hasSyncWorkspace?: boolean;
};

function getStage(data: GoogleBusinessProfileConnection | null | undefined): GbpWorkflowStage {
  if (!data || data.status === 'unlinked' || data.status === 'pending_auth') {
    return 'connect';
  }
  if (data.status === 'authorized') {
    return 'location';
  }
  if (data.status === 'reauth_required' || data.status === 'sync_error') {
    return 'issue';
  }
  return 'linked';
}

function getStageLabel(stage: GbpWorkflowStage): string {
  switch (stage) {
    case 'linked':
      return 'Linked and ready';
    case 'location':
      return 'Choose location';
    case 'issue':
      return 'Action needed';
    case 'connect':
    default:
      return 'Connect Google';
  }
}

function getLocationTitle(data: GoogleBusinessProfileConnection | null): string {
  if (!data) {
    return 'Google Business Profile';
  }
  return data.externalLocationTitle ?? data.externalLocationName ?? 'Google Business Profile';
}

function getConnectedAccountLabel(data: GoogleBusinessProfileConnection | null): string {
  if (!data) {
    return 'No Google account connected';
  }
  return data.connectedGoogleEmail ?? data.connectedGoogleName ?? 'Google account not connected';
}

function getStepStatus(
  step: 'connect' | 'location' | 'review',
  data: GoogleBusinessProfileConnection | null,
  stage: GbpWorkflowStage,
): GbpStepStatus {
  if (!data || data.status === 'unlinked' || data.status === 'pending_auth') {
    return step === 'connect' ? 'active' : 'blocked';
  }
  if (data.status === 'authorized' || data.status === 'reauth_required') {
    if (step === 'connect') return 'complete';
    if (step === 'location') return 'active';
    return 'blocked';
  }
  if (data.status === 'sync_error') {
    return step === 'review' ? 'active' : 'complete';
  }
  if (stage === 'linked') {
    return step === 'review' ? 'pending' : 'complete';
  }
  return 'pending';
}

function stepBadgeLabel(status: GbpStepStatus): string | undefined {
  if (status === 'complete') return 'Done';
  if (status === 'active') return 'Now';
  if (status === 'blocked') return 'Locked';
  return undefined;
}

function GbpFooter() {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="font-medium text-foreground">Related settings.</span> Public profile fields
        (name, address, phone, links) live on{' '}
        <Link href={PROFILE_DISCOVERY_HREF} className="underline">
          Restaurant profile
        </Link>
        . Hours and meal windows live on{' '}
        <Link href={AVAILABILITY_HREF} className="underline">
          Availability &amp; Booking types
        </Link>
        .
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <Card variant="compact" className="border-border/70 shadow-none">
      <CardContent className="flex flex-col gap-3 p-5" aria-busy="true" role="status">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </CardContent>
    </Card>
  );
}

type GbpFrameProps = {
  data: GoogleBusinessProfileConnection | null;
  stage: GbpWorkflowStage;
  overview: ReactNode;
  hasSyncWorkspace: boolean;
  onSelectAnchor: (anchorId: GbpAnchorId) => void;
  children: ReactNode;
};

function GbpFrame({
  data,
  stage,
  overview,
  hasSyncWorkspace,
  onSelectAnchor,
  children,
}: GbpFrameProps) {
  const connectionStatus = getStepStatus('connect', data, stage);
  const locationStatus = getStepStatus('location', data, stage);
  const reviewStatus = getStepStatus('review', data, stage);
  const locationEnabled =
    data?.status === 'authorized' ||
    data?.status === 'reauth_required' ||
    Boolean(data?.externalLocationId);
  const locationAnchor: GbpAnchorId =
    data?.status === 'authorized' || data?.status === 'reauth_required'
      ? 'gbp-location'
      : 'gbp-connection';
  const workflowSettled = stage === 'linked';
  const accountLabel = getConnectedAccountLabel(data);
  const hasLinkedLocation = Boolean(data?.externalLocationId);

  const railItems: RestaurantSettingsCommandRailItem[] = [
    {
      label: 'Connection',
      description: workflowSettled ? 'Reconnect if needed.' : 'Authorize access.',
      Icon: ShieldCheck,
      onSelect: () => onSelectAnchor('gbp-connection'),
      badge: workflowSettled ? undefined : stepBadgeLabel(connectionStatus),
    },
    {
      label: 'Business location',
      description: locationEnabled
        ? workflowSettled
          ? 'Mapped location.'
          : 'Map one Google listing.'
        : 'Available after the connection is authorized.',
      Icon: MapPin,
      onSelect: locationEnabled ? () => onSelectAnchor(locationAnchor) : () => {},
      badge: workflowSettled ? undefined : stepBadgeLabel(locationStatus),
    },
    ...(hasSyncWorkspace
      ? [
          {
            label: 'Review changes',
            description: 'Compare imports and exports.',
            Icon: SearchCheck,
            onSelect: () => onSelectAnchor('gbp-sync-review'),
            badge: workflowSettled ? 'Next' : stepBadgeLabel(reviewStatus),
          } satisfies RestaurantSettingsCommandRailItem,
        ]
      : []),
  ];

  return (
    <RestaurantSettingsCommandCenter
      eyebrow="Google command center"
      title="Google Business Profile"
      description="Connect Google only when you need import, comparison, and sync-review support for public restaurant details."
      metrics={[
        {
          label: 'Connection',
          value: getStageLabel(stage),
          description: accountLabel,
          variant: workflowSettled ? 'default' : stage === 'issue' ? 'destructive' : 'secondary',
          Icon: ShieldCheck,
        },
        {
          label: 'Location',
          value: hasLinkedLocation ? 'Mapped' : locationEnabled ? 'Choose one' : 'Locked',
          description: getLocationTitle(data),
          variant: hasLinkedLocation ? 'secondary' : 'outline',
          Icon: MapPin,
        },
        {
          label: 'Review',
          value: hasSyncWorkspace ? 'Available' : 'Unavailable',
          description: hasSyncWorkspace ? 'compare imports and exports' : 'connection only',
          variant: hasSyncWorkspace ? 'metric' : 'outline',
          Icon: SearchCheck,
        },
      ]}
      railTitle="Google workflow"
      railDescription={
        workflowSettled
          ? hasSyncWorkspace
            ? 'Setup complete. Jump to review or reconnect.'
            : 'Setup complete. Reconnect if needed.'
          : 'Jump to the current setup step.'
      }
      railItems={railItems}
      footer={<GbpFooter />}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div id="gbp-connection" className="scroll-mt-24">
          {overview}
        </div>
        {children}
      </div>
    </RestaurantSettingsCommandCenter>
  );
}

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
        toast.success('Google Business Profile disconnected.');
      },
      onError: (error) => toast.error(error.message),
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
          toast.success('Google Business Profile location linked.');
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }, [linkMutation, selectedLocation]);

  const handleConnectGoogle = useCallback(() => {
    if (startAuthorizationMutation.isPending) {
      return;
    }

    startAuthorizationMutation.mutate(undefined, {
      onSuccess: ({ authorizationUrl }) => {
        window.location.assign(authorizationUrl);
      },
      onError: (error) => toast.error(error.message),
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
  const showPicker = data?.status === 'authorized' || data?.status === 'reauth_required';
  const showConnect = !isLinked && !showPicker && data?.status !== 'authorized';
  const canRefresh = Boolean(data && data.status !== 'unlinked');
  const canDisconnect = Boolean(data && data.status !== 'unlinked');
  const accountLabel = getConnectedAccountLabel(data ?? null);
  const status = data?.status ?? 'unlinked';
  const locationsErrorMessage = locationsQuery.error?.message ?? null;
  const locationsArePossiblyStale =
    Boolean(locationsQuery.error) && Boolean(data?.availableLocations.length);

  const overview = (
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

  if (!restaurantId) {
    return (
      <>
        <GbpFrame {...frameProps}>
          <Card variant="compact" className="border-border/70 shadow-none">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Select a restaurant using the sidebar switcher to manage its Google Business Profile
              connection.
            </CardContent>
          </Card>
        </GbpFrame>
        {disconnectDialog}
      </>
    );
  }

  if (connectionQuery.isLoading && !data) {
    return (
      <>
        <GbpFrame {...frameProps}>
          <LoadingSkeleton />
        </GbpFrame>
        {disconnectDialog}
      </>
    );
  }

  if (connectionQuery.error) {
    return (
      <>
        <GbpFrame {...frameProps}>
          <Card variant="compact" className="border-border/70 shadow-none">
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
        </GbpFrame>
        {disconnectDialog}
      </>
    );
  }

  if (!data) {
    return (
      <>
        <GbpFrame {...frameProps}>
          <Card variant="compact" className="border-border/70 shadow-none">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Google Business Profile connection details are not available for this restaurant yet.
              Refresh to retry.
            </CardContent>
          </Card>
        </GbpFrame>
        {disconnectDialog}
      </>
    );
  }

  return (
    <>
      <GbpFrame {...frameProps}>
        {showConnect ? (
          <div className="scroll-mt-24">
            <ConnectCard
              onConnect={handleConnectGoogle}
              isConfigured={data.isConfigured}
              isConnecting={startAuthorizationMutation.isPending}
              isPendingAuth={data.status === 'pending_auth'}
              lastError={!isLinked ? data.lastError : null}
            />
          </div>
        ) : null}

        {showPicker ? (
          <div id="gbp-location" className="scroll-mt-24">
            <LocationPickerCard
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
          </div>
        ) : null}

        {isLinked ? (
          <Card variant="compact" className="border-border/70 shadow-none">
            <CardContent className="px-4 py-4 sm:px-5">
              {data.status === 'sync_error' && data.lastError ? (
                <Alert variant="destructive">
                  <AlertTitle>Last sync failed</AlertTitle>
                  <AlertDescription>{data.lastError}</AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTitle>
                    {hasSyncWorkspace ? 'Review changes below' : 'Google Business Profile linked'}
                  </AlertTitle>
                  <AlertDescription>
                    {hasSyncWorkspace
                      ? 'Use the sync workspace below before changing Nabatable or Google.'
                      : 'Google is linked. Comparison tools are currently unavailable, so review changes directly in Nabatable and Google for now.'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : null}
      </GbpFrame>
      {disconnectDialog}
    </>
  );
}
