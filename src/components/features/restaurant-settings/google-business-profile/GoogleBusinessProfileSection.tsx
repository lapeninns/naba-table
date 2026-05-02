'use client';

import { ExternalLink, RefreshCcw, Unplug } from 'lucide-react';
import Link from 'next/link';
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
import { opsHref } from '@/lib/url/opsHref';
import {
  OPS_RESTAURANTS_BASE,
  type GoogleBusinessProfileAvailableLocation,
  type GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

import { SETTINGS_COMPACT_ACTION_BAR_CLASS } from '../shared';
import { ConnectCard } from './components/ConnectCard';
import { LocationPickerCard } from './components/LocationPickerCard';
import { StatusBadge, connectionStatusBadge } from './components/StatusBadge';
import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from './googleBusinessProfileConnectionModel';
import { formatLastSync } from './lib/formatters';

import type { ReactNode } from 'react';

const GBP_ANCHOR_IDS = ['gbp-connection', 'gbp-location'] as const;

type GbpAnchorId = (typeof GBP_ANCHOR_IDS)[number];

const GBP_ANCHOR_ID_SET = new Set<string>(GBP_ANCHOR_IDS);

function isGbpAnchorId(value: string): value is GbpAnchorId {
  return GBP_ANCHOR_ID_SET.has(value);
}

const PROFILE_DISCOVERY_HREF = opsHref('/settings/restaurant/profile#profile-discovery');
const AVAILABILITY_HREF = opsHref('/settings/restaurant/availability');

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
};

type GbpActionBarProps = {
  status: GoogleBusinessProfileConnection['status'];
  lastPullAt: string | null;
  onRefresh: (() => void) | null;
  isRefreshing: boolean;
  manageOnGoogleHref: string | null;
  canDisconnect: boolean;
  onDisconnect: (() => void) | null;
  isDisconnecting: boolean;
};

function GbpActionBar({
  status,
  lastPullAt,
  onRefresh,
  isRefreshing,
  manageOnGoogleHref,
  canDisconnect,
  onDisconnect,
  isDisconnecting,
}: GbpActionBarProps) {
  const badge = connectionStatusBadge(status);
  const canRefresh = onRefresh !== null;

  return (
    <div data-testid="gbp-action-bar" className={SETTINGS_COMPACT_ACTION_BAR_CLASS}>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={badge.tone} label={badge.label} />
        <span className="text-xs text-muted-foreground">
          Last checked: <span className="text-foreground">{formatLastSync(lastPullAt)}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh ?? undefined}
            disabled={isRefreshing}
          >
            <RefreshCcw
              data-icon="inline-start"
              className={isRefreshing ? 'animate-spin' : undefined}
            />
            Refresh Google
          </Button>
        ) : null}
        {manageOnGoogleHref ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={manageOnGoogleHref} target="_blank" rel="noreferrer">
              <ExternalLink data-icon="inline-start" />
              Manage on Google
            </a>
          </Button>
        ) : null}
        {canDisconnect && onDisconnect ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="text-destructive hover:text-destructive"
          >
            <Unplug data-icon="inline-start" />
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type GbpShellProps = {
  actionBar: ReactNode;
  children: ReactNode;
};

function GbpShell({ actionBar, children }: GbpShellProps) {
  return (
    <div className="flex flex-col gap-6">
      {actionBar}
      {children}
      <Alert>
        <AlertTitle>Related settings</AlertTitle>
        <AlertDescription>
          Public profile fields (name, address, phone, links) live on{' '}
          <Link href={PROFILE_DISCOVERY_HREF} className="underline">
            Restaurant profile
          </Link>
          . Hours and meal windows live on{' '}
          <Link href={AVAILABILITY_HREF} className="underline">
            Availability &amp; Occasions
          </Link>
          .
        </AlertDescription>
      </Alert>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
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

  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.slice(1);
      if (!raw || !isGbpAnchorId(raw)) {
        return;
      }
      requestAnimationFrame(() => {
        document.getElementById(raw)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

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

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => {
        setSelectedLocationValue('');
        toast.success('Google Business Profile disconnected.');
      },
      onError: (error) => toast.error(error.message),
    });
  };

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

  if (!restaurantId) {
    return (
      <GbpShell
        actionBar={
          <GbpActionBar
            status="unlinked"
            lastPullAt={null}
            onRefresh={null}
            isRefreshing={false}
            manageOnGoogleHref={null}
            canDisconnect={false}
            onDisconnect={null}
            isDisconnecting={false}
          />
        }
      >
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Select a restaurant using the sidebar switcher to manage its Google Business Profile
            connection.
          </CardContent>
        </Card>
      </GbpShell>
    );
  }

  const refreshHandler = () => void connectionQuery.refetch();

  if (connectionQuery.isLoading && !data) {
    return (
      <GbpShell
        actionBar={
          <GbpActionBar
            status="unlinked"
            lastPullAt={null}
            onRefresh={refreshHandler}
            isRefreshing={connectionQuery.isFetching}
            manageOnGoogleHref={null}
            canDisconnect={false}
            onDisconnect={null}
            isDisconnecting={false}
          />
        }
      >
        <LoadingSkeleton />
      </GbpShell>
    );
  }

  if (connectionQuery.error) {
    return (
      <GbpShell
        actionBar={
          <GbpActionBar
            status="unlinked"
            lastPullAt={null}
            onRefresh={refreshHandler}
            isRefreshing={connectionQuery.isFetching}
            manageOnGoogleHref={null}
            canDisconnect={false}
            onDisconnect={null}
            isDisconnecting={false}
          />
        }
      >
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
      </GbpShell>
    );
  }

  if (!data) {
    return (
      <GbpShell
        actionBar={
          <GbpActionBar
            status="unlinked"
            lastPullAt={null}
            onRefresh={refreshHandler}
            isRefreshing={connectionQuery.isFetching}
            manageOnGoogleHref={null}
            canDisconnect={false}
            onDisconnect={null}
            isDisconnecting={false}
          />
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Google Business Profile connection details are not available for this restaurant yet.
            Refresh to retry.
          </CardContent>
        </Card>
      </GbpShell>
    );
  }

  const connectHref = `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/connect`;
  const manageOnGoogleHref = buildGoogleMapsPlaceHref(data.externalPlaceId);
  const hasLinkedLocation = Boolean(data.externalLocationId);
  const isLinked = data.status === 'linked' || data.status === 'sync_error';
  const showPicker = data.status === 'authorized' || data.status === 'reauth_required';
  const showConnect = !isLinked && !showPicker && data.status !== 'authorized';
  const canRefresh = data.status !== 'unlinked';

  return (
    <GbpShell
      actionBar={
        <GbpActionBar
          status={data.status}
          lastPullAt={data.lastPullAt}
          onRefresh={canRefresh ? refreshHandler : null}
          isRefreshing={connectionQuery.isFetching}
          manageOnGoogleHref={manageOnGoogleHref}
          canDisconnect={data.status !== 'unlinked'}
          onDisconnect={handleDisconnect}
          isDisconnecting={disconnectMutation.isPending}
        />
      }
    >
      {showConnect ? (
        <div id="gbp-connection" className="scroll-mt-24">
          <ConnectCard
            connectHref={connectHref}
            isConfigured={data.isConfigured}
            isPendingAuth={data.status === 'pending_auth'}
            lastError={!isLinked ? data.lastError : null}
          />
        </div>
      ) : null}

      {showPicker ? (
        <div id="gbp-location" className="scroll-mt-24">
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
        </div>
      ) : null}

      {isLinked ? (
        <div id="gbp-connection" className="scroll-mt-24">
          <Card>
            <CardContent className="flex flex-col gap-3 py-5">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Linked location
                </p>
                <p className="text-sm font-medium text-foreground">
                  {data.externalLocationTitle ?? data.externalLocationName ?? 'Linked'}
                </p>
                {data.connectedGoogleEmail ? (
                  <p className="text-xs text-muted-foreground">
                    Authorized as{' '}
                    <span className="text-foreground">{data.connectedGoogleEmail}</span>
                  </p>
                ) : null}
              </div>
              {data.status === 'sync_error' && data.lastError ? (
                <Alert variant="destructive">
                  <AlertTitle>Last sync failed</AlertTitle>
                  <AlertDescription>{data.lastError}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </GbpShell>
  );
}
