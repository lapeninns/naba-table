'use client';

import { Building2, ExternalLink, Link2, RefreshCcw, ShieldCheck, Unplug } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOpsDisconnectGoogleBusinessProfile,
  useOpsGoogleBusinessProfileConnection,
  useOpsLinkGoogleBusinessProfileLocation,
  useOpsSyncGoogleBusinessProfile,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { OPS_RESTAURANTS_BASE, type GoogleBusinessProfileAvailableLocation } from '@/services/ops/restaurants';

import { GoogleBusinessProfileBusinessInfoPanel } from './GoogleBusinessProfileBusinessInfoPanel';
import { GoogleBusinessProfileSyncActionDialog } from './GoogleBusinessProfileSyncActionDialog';
import { SettingsCard } from './shared/SettingsCard';

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
};

function statusLabel(
  status: GoogleBusinessProfileSectionData['status'],
): string {
  switch (status) {
    case 'linked':
      return 'Linked';
    case 'authorized':
      return 'Authorized';
    case 'pending_auth':
      return 'Awaiting Google';
    case 'reauth_required':
      return 'Reconnect required';
    case 'sync_error':
      return 'Needs attention';
    default:
      return 'Not connected';
  }
}

function statusVariant(status: GoogleBusinessProfileSectionData['status']) {
  switch (status) {
    case 'linked':
      return 'default' as const;
    case 'authorized':
      return 'secondary' as const;
    case 'reauth_required':
    case 'sync_error':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

type GoogleBusinessProfileSectionData = NonNullable<
  ReturnType<typeof useOpsGoogleBusinessProfileConnection>['data']
>;

function buildLocationValue(location: GoogleBusinessProfileAvailableLocation): string {
  return JSON.stringify({
    accountName: location.accountName,
    accountId: location.accountId,
    locationName: location.locationName,
    locationId: location.locationId,
  });
}

export function GoogleBusinessProfileSection({
  restaurantId,
}: GoogleBusinessProfileSectionProps) {
  const searchParams = useSearchParams();
  const connectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const linkMutation = useOpsLinkGoogleBusinessProfileLocation(restaurantId);
  const disconnectMutation = useOpsDisconnectGoogleBusinessProfile(restaurantId);
  const syncMutation = useOpsSyncGoogleBusinessProfile(restaurantId);
  const [selectedLocationValue, setSelectedLocationValue] = useState<string>('');
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

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

  const selectedLocation = useMemo(() => {
    if (!selectedLocationValue || !data) {
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
      <SettingsCard
        title="Google Business Profile"
        description="Connect a Google account and link the matching Business Profile location."
      >
        <p className="text-sm text-muted-foreground">
          Select a restaurant using the sidebar switcher to manage its Google Business Profile connection.
        </p>
      </SettingsCard>
    );
  }

  if (connectionQuery.isLoading && !data) {
    return (
      <SettingsCard
        title="Google Business Profile"
        description="Connect Google and choose which Business Profile location belongs to this restaurant."
      >
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </SettingsCard>
    );
  }

  if (connectionQuery.error) {
    return (
      <SettingsCard
        title="Google Business Profile"
        description="Connect Google and choose which Business Profile location belongs to this restaurant."
      >
        <Alert variant="destructive">
          <AlertTitle>Unable to load Google Business Profile</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
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
      </SettingsCard>
    );
  }

  if (!data) {
    return null;
  }

  const connectHref = `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/connect`;
  const isDisconnecting = disconnectMutation.isPending;
  const isLinking = linkMutation.isPending;
  const isSyncing = syncMutation.isPending;

  return (
    <SettingsCard
      title="Google Business Profile"
      description="Connect Google, select the right GBP location, and prepare the restaurant for native business-information sync."
      headerAction={
        <Badge variant={statusVariant(data.status)} className="whitespace-nowrap">
          {statusLabel(data.status)}
        </Badge>
      }
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            OAuth credentials stay on the server. Nabatable uses them to discover, sync, and retain canonical GBP-backed business information.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void connectionQuery.refetch()}
              disabled={connectionQuery.isFetching}
            >
              <RefreshCcw className="mr-2 size-4" />
              Refresh
            </Button>
            {data.externalLocationId ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setSyncDialogOpen(true)}
                disabled={isSyncing}
              >
                <RefreshCcw className="mr-2 size-4" />
                {isSyncing ? 'Syncing...' : 'Sync now'}
              </Button>
            ) : null}
            {data.status !== 'unlinked' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  disconnectMutation.mutate(undefined, {
                    onSuccess: () => {
                      setSelectedLocationValue('');
                      toast.success('Google Business Profile disconnected.');
                    },
                    onError: (error) => {
                      toast.error(error.message);
                    },
                  })
                }
                disabled={isDisconnecting}
              >
                <Unplug className="mr-2 size-4" />
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {!data.isConfigured ? (
          <Alert>
            <AlertTitle>Integration not configured</AlertTitle>
            <AlertDescription>
              Google Business Profile credentials are not available in this environment yet, so the dashboard cannot start the OAuth flow.
            </AlertDescription>
          </Alert>
        ) : null}

        {data.lastError ? (
          <Alert variant={data.status === 'reauth_required' || data.status === 'sync_error' ? 'destructive' : 'default'}>
            <AlertTitle>Connection notice</AlertTitle>
            <AlertDescription>{data.lastError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Google account</p>
            <p className="text-sm font-medium text-foreground">
              {data.connectedGoogleEmail ?? 'Not connected'}
            </p>
            {data.connectedGoogleName ? (
              <p className="text-xs text-muted-foreground">{data.connectedGoogleName}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Linked location</p>
            <p className="text-sm font-medium text-foreground">
              {data.externalLocationTitle ?? data.externalLocationId ?? 'No location linked'}
            </p>
            {data.externalLocationId ? (
              <p className="text-xs text-muted-foreground">{data.externalLocationId}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Discovery</p>
            <p className="text-sm font-medium text-foreground">
              {data.availableLocations.length} location{data.availableLocations.length === 1 ? '' : 's'} available
            </p>
            <p className="text-xs text-muted-foreground">
              {data.lastPullAt ? `Last synced ${new Date(data.lastPullAt).toLocaleString('en-GB')}` : 'Live from the connected Google credentials'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" asChild disabled={!data.isConfigured}>
            <a href={connectHref}>
              <ShieldCheck className="mr-2 size-4" />
              {data.status === 'unlinked' ? 'Connect Google Business Profile' : 'Reconnect Google'}
            </a>
          </Button>
          {data.connectedGoogleEmail ? (
            <p className="text-sm text-muted-foreground">
              Authorized as <span className="font-medium text-foreground">{data.connectedGoogleEmail}</span>.
            </p>
          ) : null}
        </div>

        {data.isConfigured && data.connectedGoogleEmail && data.availableLocations.length === 0 ? (
          <Alert>
            <AlertTitle>No accessible GBP locations found</AlertTitle>
            <AlertDescription>
              Google authorization succeeded, but this account does not currently expose any Business Profile locations to Nabatable.
            </AlertDescription>
          </Alert>
        ) : null}

        {data.availableLocations.length > 0 ? (
          <div className="space-y-4 rounded-xl border border-border/60 bg-background p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Choose the GBP location for this restaurant</h3>
              <p className="text-sm text-muted-foreground">
                Link one Google Business Profile location to the current restaurant record, then sync its business information into Nabatable&apos;s canonical tables.
              </p>
            </div>

            <Select value={selectedLocationValue} onValueChange={setSelectedLocationValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a Google Business Profile location" />
              </SelectTrigger>
              <SelectContent>
                {data.availableLocations.map((location) => (
                  <SelectItem key={buildLocationValue(location)} value={buildLocationValue(location)}>
                    {location.title ?? location.locationId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedLocation ? (
              <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Business</p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedLocation.title ?? selectedLocation.locationId}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Account</p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedLocation.accountDisplayName ?? selectedLocation.accountId}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Address</p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedLocation.addressText ?? 'Address unavailable'}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => {
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
                      onError: (error) => {
                        toast.error(error.message);
                      },
                    },
                  );
                }}
                disabled={!selectedLocation || isLinking}
              >
                <Link2 className="mr-2 size-4" />
                {isLinking ? 'Linking...' : data.status === 'linked' ? 'Relink location' : 'Link location'}
              </Button>

              {selectedLocation?.placeId ? (
                <Button type="button" variant="outline" asChild>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(selectedLocation.placeId)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-2 size-4" />
                    Open in Google Maps
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <GoogleBusinessProfileBusinessInfoPanel
          businessName={data.externalLocationTitle}
          businessInfo={data.businessInfo}
          lastPullAt={data.lastPullAt}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="size-4" />
              Canonical data stays in Nabatable
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Synced GBP business information is written into Nabatable-owned business-information tables with provider provenance, so the dashboard reads a single canonical model.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="size-4" />
              Provider snapshots retained
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Raw GBP location and attribute payloads remain in the integration layer, so we keep lineage without turning Google into a competing business-data model.
            </p>
          </div>
        </div>
      </div>
      <GoogleBusinessProfileSyncActionDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        title="Fetch latest GBP business information"
        description="Refresh Nabatable's canonical GBP business-information snapshot. This action updates the fetched GBP tables and verification metadata, but it does not overwrite core Nabatable profile, hours, or service-period values."
        confirmLabel="Fetch from GBP"
        isPending={isSyncing}
        errorMessage={syncMutation.error?.message ?? null}
        onConfirm={({ password }) => {
          syncMutation.mutate(
            { password },
            {
              onSuccess: (state) => {
                setSyncDialogOpen(false);
                const warning = state.lastError;
                if (warning) {
                  toast.success('Business information synced, with a partial warning.');
                  toast.warning(warning);
                  return;
                }
                toast.success('Google Business Profile business information synced.');
              },
              onError: (error) => {
                toast.error(error.message);
              },
            },
          );
        }}
      />
    </SettingsCard>
  );
}
