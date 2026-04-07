'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOpsDisconnectRestaurantGoogleBusinessProfile,
  useOpsRefreshRestaurantGoogleBusinessProfileCatalog,
  useOpsRestaurantGoogleBusinessProfile,
  useOpsRestaurantGoogleBusinessProfileConnect,
  useOpsSyncRestaurantGoogleBusinessProfile,
} from '@/hooks/ops/useOpsRestaurantGoogleBusinessProfile';

import { SettingsSectionHeader } from './shared/SettingsSectionHeader';

type RestaurantGoogleBusinessProfileSectionProps = {
  restaurantId: string;
};

function buildLocationValue(accountId: string, locationId: string) {
  return `${accountId}::${locationId}`;
}

function parseLocationValue(value: string) {
  const [accountId, locationId] = value.split('::');
  return {
    accountId: accountId ?? '',
    locationId: locationId ?? '',
  };
}

function statusLabel(status: string) {
  switch (status) {
    case 'synced':
      return 'Synced';
    case 'needs_location':
      return 'Needs location';
    case 'connected':
      return 'Connected';
    case 'error':
      return 'Attention needed';
    default:
      return 'Not connected';
  }
}

export function RestaurantGoogleBusinessProfileSection({
  restaurantId,
}: RestaurantGoogleBusinessProfileSectionProps) {
  const searchParams = useSearchParams();
  const statusQuery = useOpsRestaurantGoogleBusinessProfile(restaurantId);
  const connectMutation = useOpsRestaurantGoogleBusinessProfileConnect(restaurantId);
  const refreshMutation = useOpsRefreshRestaurantGoogleBusinessProfileCatalog(restaurantId);
  const syncMutation = useOpsSyncRestaurantGoogleBusinessProfile(restaurantId);
  const disconnectMutation = useOpsDisconnectRestaurantGoogleBusinessProfile(restaurantId);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [uiError, setUiError] = useState<string | null>(null);

  const connection = statusQuery.data;

  useEffect(() => {
    if (!connection) {
      setSelectedLocation('');
      return;
    }

    const matched =
      connection.availableLocations.find(
        (location) =>
          location.accountId === connection.accountId && location.locationId === connection.locationId,
      ) ?? connection.availableLocations[0] ?? null;

    setSelectedLocation(
      matched ? buildLocationValue(matched.accountId, matched.locationId) : '',
    );
  }, [connection]);

  const callbackState = searchParams.get('googleBusinessProfile');
  const callbackMessage = searchParams.get('message');

  const pending =
    connectMutation.isPending ||
    refreshMutation.isPending ||
    syncMutation.isPending ||
    disconnectMutation.isPending;

  const importedHighlights = useMemo(() => {
    const profile = connection?.normalizedProfile;
    if (!profile) {
      return [];
    }

    return [
      profile.primaryCategory ? `Category: ${profile.primaryCategory}` : null,
      typeof profile.rating === 'number' && typeof profile.reviewCount === 'number'
        ? `Google rating: ${profile.rating.toFixed(1)} (${profile.reviewCount} reviews)`
        : null,
      profile.addressText ? `Address: ${profile.addressText}` : null,
      profile.websiteUri ? `Website imported` : null,
      profile.media.length > 0 ? `${profile.media.length} media items imported` : null,
    ].filter((item): item is string => Boolean(item));
  }, [connection?.normalizedProfile]);

  const handleConnect = async () => {
    setUiError(null);
    try {
      const authorizationUrl = await connectMutation.mutateAsync();
      if (authorizationUrl.includes('mock=1')) {
        await refreshMutation.mutateAsync();
        return;
      }
      window.location.assign(authorizationUrl);
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Unable to start Google Business Profile connection.');
    }
  };

  const handleSync = async () => {
    setUiError(null);
    try {
      if (!selectedLocation) {
        await syncMutation.mutateAsync({});
        return;
      }
      const parsed = parseLocationValue(selectedLocation);
      await syncMutation.mutateAsync(parsed);
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Unable to sync Google Business Profile.');
    }
  };

  const handleDisconnect = async () => {
    setUiError(null);
    try {
      await disconnectMutation.mutateAsync();
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Unable to disconnect Google Business Profile.');
    }
  };

  if (statusQuery.isLoading && !connection) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 p-5">
        <SettingsSectionHeader
          title="Google Business Profile"
          description="Connect Google and import live profile details for the public restaurant page."
        />
        <div className="space-y-3">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border/60 bg-muted/20 p-5">
      <SettingsSectionHeader
        title="Google Business Profile"
        description="Connect this venue to Google Business Profile so Ops can import live profile details, reviews, media, and profile metadata for the curated landing page."
        action={
          <Badge variant={connection?.status === 'synced' ? 'default' : 'secondary'}>
            {statusLabel(connection?.status ?? 'disconnected')}
          </Badge>
        }
      />

      <div className="space-y-4">
        {(callbackState === 'connected' || callbackState === 'error' || uiError || connection?.lastSyncError) && (
          <Alert variant={callbackState === 'error' || uiError || connection?.lastSyncError ? 'destructive' : 'default'}>
            <AlertTitle>
              {callbackState === 'connected'
                ? 'Google Business Profile connected'
                : callbackState === 'error'
                  ? 'Google Business Profile connection failed'
                  : connection?.lastSyncError
                    ? 'Latest sync failed'
                    : 'Google Business Profile update'}
            </AlertTitle>
            <AlertDescription>
              {uiError || callbackMessage || connection?.lastSyncError || 'Connection updated successfully.'}
            </AlertDescription>
          </Alert>
        )}

        {statusQuery.error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load Google Business Profile status</AlertTitle>
            <AlertDescription>{statusQuery.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 rounded-md border border-border/60 bg-background p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {connection?.connected
                ? connection.locationTitle ?? connection.accountName ?? 'Google Business Profile connected'
                : 'Not connected yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {connection?.connected
                ? 'Once connected, select the matching Google location and sync profile data into Nab a Table.'
                : 'Connect Google Business Profile to import categories, descriptions, review links, review signals, media, and supporting metadata.'}
            </p>
            {connection?.oauthConnectedAt ? (
              <p className="text-xs text-muted-foreground">
                Connected on {new Date(connection.oauthConnectedAt).toLocaleString()}
              </p>
            ) : null}
            {connection?.lastSyncAt ? (
              <p className="text-xs text-muted-foreground">
                Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleConnect} disabled={pending}>
              {connection?.connected ? 'Reconnect Google' : 'Connect Google'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={pending || !connection?.connected}
            >
              Refresh locations
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDisconnect}
              disabled={pending || !connection?.connected}
            >
              Disconnect
            </Button>
          </div>
        </div>

        {connection?.connected ? (
          <div className="space-y-3 rounded-md border border-border/60 bg-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Linked Google location</p>
              <p className="text-sm text-muted-foreground">
                Choose which Google Business Profile location should power this restaurant page.
              </p>
            </div>

            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger aria-label="Google Business Profile location">
                <SelectValue placeholder="Select a Google location" />
              </SelectTrigger>
              <SelectContent>
                {(connection.availableLocations ?? []).map((location) => (
                  <SelectItem
                    key={buildLocationValue(location.accountId, location.locationId)}
                    value={buildLocationValue(location.accountId, location.locationId)}
                  >
                    {location.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedLocation ? (
              <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                {(() => {
                  const selected = connection.availableLocations.find(
                    (location) =>
                      buildLocationValue(location.accountId, location.locationId) === selectedLocation,
                  );
                  if (!selected) {
                    return 'Select a Google location to preview imported details.';
                  }

                  return (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{selected.title}</p>
                      {selected.addressText ? <p>{selected.addressText}</p> : null}
                      {selected.primaryPhone ? <p>{selected.primaryPhone}</p> : null}
                    </div>
                  );
                })()}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleSync} disabled={pending || connection.availableLocations.length === 0}>
                {syncMutation.isPending ? 'Syncing…' : 'Sync Google data'}
              </Button>
            </div>
          </div>
        ) : null}

        {connection?.normalizedProfile ? (
          <div className="space-y-3 rounded-md border border-border/60 bg-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Imported profile snapshot</p>
              <p className="text-sm text-muted-foreground">
                This summary is what Nab a Table can now use to enrich the public landing page.
              </p>
            </div>

            {connection.normalizedProfile.description ? (
              <p className="text-sm text-foreground">{connection.normalizedProfile.description}</p>
            ) : null}

            {importedHighlights.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {importedHighlights.map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 text-sm">
              {connection.normalizedProfile.mapsUri ? (
                <a
                  href={connection.normalizedProfile.mapsUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Open Google Maps
                </a>
              ) : null}
              {connection.normalizedProfile.reviewUri ? (
                <a
                  href={connection.normalizedProfile.reviewUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Open review link
                </a>
              ) : null}
              {connection.normalizedProfile.websiteUri ? (
                <a
                  href={connection.normalizedProfile.websiteUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Open website
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
