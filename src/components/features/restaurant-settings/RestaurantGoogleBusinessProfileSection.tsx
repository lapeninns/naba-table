'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGoogleBusinessProfileLabel } from '@/lib/restaurants/google-business-profile-format';
import {
  useOpsDisconnectRestaurantGoogleBusinessProfile,
  useOpsRefreshRestaurantGoogleBusinessProfileCatalog,
  useOpsRestaurantGoogleBusinessProfile,
  useOpsRestaurantGoogleBusinessProfileConnect,
  useOpsSyncRestaurantGoogleBusinessProfile,
} from '@src/hooks/ops/useOpsRestaurantGoogleBusinessProfile';

import {
  buildLocationValue,
  ChangeSummarySection,
  DetailList,
  formatDateTime,
  MediaList,
  parseLocationValue,
  ReviewsList,
  SectionPanel,
  statusBadgeVariant,
  statusLabel,
  SyncHealthSection,
  SyncHistoryTimeline,
} from './RestaurantGoogleBusinessProfileShared';
import { SettingsCard } from './shared/SettingsCard';

type RestaurantGoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
};

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

    setSelectedLocation(matched ? buildLocationValue(matched.accountId, matched.locationId) : '');
  }, [connection]);

  const callbackState = searchParams.get('googleBusinessProfile');
  const callbackMessage = searchParams.get('message');
  const pending =
    connectMutation.isPending ||
    refreshMutation.isPending ||
    syncMutation.isPending ||
    disconnectMutation.isPending;

  const selectedLocationOption = useMemo(
    () =>
      connection?.availableLocations.find(
        (location) => buildLocationValue(location.accountId, location.locationId) === selectedLocation,
      ) ?? null,
    [connection?.availableLocations, selectedLocation],
  );

  const importedHighlights = useMemo(() => {
    const profile = connection?.normalizedProfile;
    if (!profile) {
      return [];
    }

    return [
      profile.primaryCategory ? `Primary category: ${profile.primaryCategory}` : null,
      profile.placeId ? `Place ID: ${profile.placeId}` : null,
      profile.openStatus ? `Open status: ${profile.openStatus}` : null,
      typeof profile.rating === 'number' && typeof profile.reviewCount === 'number'
        ? `Rating ${profile.rating.toFixed(1)} from ${profile.reviewCount} reviews`
        : null,
      profile.reviewSnippets.length > 0 ? `${profile.reviewSnippets.length} review snippets imported` : null,
      profile.media.length > 0 ? `${profile.media.length} media items imported` : null,
      profile.metrics30d.length > 0 ? `${profile.metrics30d.length} performance metrics collected` : null,
      profile.serviceItems.length > 0 ? `${profile.serviceItems.length} service items discovered` : null,
    ].filter((value): value is string => Boolean(value));
  }, [connection?.normalizedProfile]);

  const syncWarning =
    connection?.status === 'partial' || connection?.syncFamilies.some((family) => family.status === 'failed')
      ? connection?.lastSyncError
      : null;

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

  if (!restaurantId) {
    return (
      <SettingsCard
        title="Google Business Profile"
        description="Select a restaurant to connect and sync Google listing data."
      >
        <p className="text-sm text-muted-foreground">
          Choose a restaurant using the sidebar switcher to connect its Google Business Profile account and review
          imported listing data.
        </p>
      </SettingsCard>
    );
  }

  if (statusQuery.isLoading && !connection) {
    return (
      <SettingsCard
        title="Google Business Profile"
        description="Connect, sync, and review imported Google listing data for the active restaurant."
        headerAction={<Badge variant={statusBadgeVariant('loading')}>{statusLabel('loading')}</Badge>}
      >
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Google Business Profile"
      description="Connect, sync, and review imported Google listing data for the active restaurant."
      headerAction={
        <Badge variant={statusBadgeVariant(connection?.status ?? 'disconnected')}>
          {statusLabel(connection?.status ?? 'disconnected')}
        </Badge>
      }
    >
      <div className="space-y-6">
        {callbackState === 'connected' ? (
          <Alert variant="success">
            <AlertTitle>Google Business Profile connected</AlertTitle>
            <AlertDescription>Connection updated successfully. Refresh the catalog or run a sync when ready.</AlertDescription>
          </Alert>
        ) : null}

        {callbackState === 'error' ? (
          <Alert variant="destructive">
            <AlertTitle>Google Business Profile connection failed</AlertTitle>
            <AlertDescription>{callbackMessage ?? 'Unable to complete the Google connection flow.'}</AlertDescription>
          </Alert>
        ) : null}

        {uiError ? (
          <Alert variant="destructive">
            <AlertTitle>Google Business Profile action failed</AlertTitle>
            <AlertDescription>{uiError}</AlertDescription>
          </Alert>
        ) : null}

        {statusQuery.error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load Google Business Profile status</AlertTitle>
            <AlertDescription>{statusQuery.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {syncWarning ? (
          <Alert variant={connection?.status === 'partial' ? 'warning' : 'destructive'}>
            <AlertTitle>{connection?.status === 'partial' ? 'Partial sync completed' : 'Latest sync failed'}</AlertTitle>
            <AlertDescription>{syncWarning}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
          <SectionPanel
            title={connection?.connected ? 'Connection status' : 'Connect Google'}
            description="Use this workspace to connect a Google account, choose a location, and keep imported listing data up to date."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {connection?.connected
                    ? connection.locationTitle ?? connection.accountName ?? 'Google Business Profile connected'
                    : 'No Google Business Profile is connected yet'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {connection?.connected
                    ? 'Connected accounts can refresh their location catalog, switch locations, and run manual syncs without leaving this page.'
                    : 'Connect Google Business Profile to import profile details, categories, reviews, media, attributes, and performance metrics for this venue.'}
                </p>
              </div>

              <DetailList
                items={[
                  { label: 'Connected account', value: connection?.accountName },
                  { label: 'Selected location', value: connection?.locationTitle },
                  { label: 'OAuth connected at', value: formatDateTime(connection?.oauthConnectedAt ?? null) },
                  { label: 'Last sync', value: formatDateTime(connection?.lastSyncAt ?? null) },
                ]}
              />

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
          </SectionPanel>

          <SectionPanel
            title="Imported overview"
            description="A quick read on what the last successful sync brought into Nab a Table."
          >
            {connection?.normalizedProfile ? (
              <div className="space-y-4">
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

                <div className="flex flex-wrap gap-3 text-sm">
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
            ) : (
              <p className="text-sm text-muted-foreground">
                No imported snapshot is available yet. Choose a location and run a sync to populate profile data.
              </p>
            )}
          </SectionPanel>
        </div>

        {connection?.connected ? (
          <SectionPanel
            title="Location selection and sync"
            description="Choose the Google location that should represent this restaurant, then run a manual sync."
          >
            <div className="space-y-4">
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

              {selectedLocationOption ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground">{selectedLocationOption.title}</p>
                  {selectedLocationOption.addressText ? (
                    <p className="mt-1 text-sm text-muted-foreground">{selectedLocationOption.addressText}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedLocationOption.primaryPhone ? (
                      <Badge variant="outline">{selectedLocationOption.primaryPhone}</Badge>
                    ) : null}
                    {selectedLocationOption.websiteUri ? <Badge variant="outline">Website available</Badge> : null}
                    <Badge variant="outline">Match score {selectedLocationOption.matchScore}</Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Refresh the Google catalog if you do not see the right location yet.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleSync} disabled={pending || connection.availableLocations.length === 0}>
                  {syncMutation.isPending ? 'Syncing…' : 'Sync Google data'}
                </Button>
              </div>
            </div>
          </SectionPanel>
        ) : null}

        <SectionPanel
          title="What changed since last sync"
          description="A quick diff against the previous synced snapshot so Ops can spot listing drift without opening every section."
        >
          <ChangeSummarySection summary={connection?.latestChangeSummary ?? null} />
        </SectionPanel>

        <SectionPanel
          title="Recent sync history"
          description="Review the latest manual sync attempts, including partial and failed runs, without losing the current snapshot."
        >
          <SyncHistoryTimeline history={connection?.syncHistory ?? []} />
        </SectionPanel>

        <div className="grid gap-4 xl:grid-cols-2">
          <SectionPanel
            title="Sync health"
            description="Each Google API family is tracked separately so unsupported endpoints do not block the rest of the sync."
          >
            {connection ? <SyncHealthSection connection={connection} /> : null}
          </SectionPanel>

          <SectionPanel
            title="Core location details"
            description="Normalized listing data used to enrich the restaurant record and public venue page."
          >
            <DetailList
              items={[
                { label: 'Title', value: connection?.normalizedProfile?.title },
                { label: 'Primary category', value: connection?.normalizedProfile?.primaryCategory },
                {
                  label: 'Additional categories',
                  value: connection?.normalizedProfile?.additionalCategories.join(', '),
                },
                { label: 'Address', value: connection?.normalizedProfile?.addressText },
                { label: 'Locality', value: connection?.normalizedProfile?.locality },
                { label: 'Region code', value: connection?.normalizedProfile?.regionCode },
                { label: 'Postal code', value: connection?.normalizedProfile?.postalCode },
                { label: 'Place ID', value: connection?.normalizedProfile?.placeId },
                { label: 'Open status', value: connection?.normalizedProfile?.openStatus },
                { label: 'Primary phone', value: connection?.normalizedProfile?.primaryPhone },
                {
                  label: 'Additional phones',
                  value: connection?.normalizedProfile?.additionalPhones.join(', '),
                },
              ]}
            />
          </SectionPanel>

          <SectionPanel
            title="Hours, attributes, and performance"
            description="Operational fields Google exposes for the connected location."
          >
            <div className="space-y-4">
              <DetailList
                items={[
                  {
                    label: 'Regular hours',
                    value: connection?.normalizedProfile?.regularHoursSummary.join(' | '),
                  },
                  {
                    label: 'Additional hours',
                    value: connection?.normalizedProfile?.moreHoursSummary.join(' | '),
                  },
                  {
                    label: 'Special hours',
                    value: connection?.normalizedProfile?.specialHoursSummary.join(' | '),
                  },
                ]}
              />

              {connection?.normalizedProfile?.attributeLabels?.length ? (
                <div className="flex flex-wrap gap-2">
                  {connection.normalizedProfile.attributeLabels.map((attribute) => (
                    <Badge key={attribute} variant="outline">
                      {attribute}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attribute labels were returned for this location.</p>
              )}

              {connection?.normalizedProfile?.serviceItems?.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Service items</p>
                  <div className="flex flex-wrap gap-2">
                    {connection.normalizedProfile.serviceItems.map((serviceItem) => (
                      <Badge key={serviceItem} variant="outline">
                        {serviceItem}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No service-item details were returned for this location.</p>
              )}

              {connection?.normalizedProfile?.metrics30d?.length ? (
                <div className="space-y-2">
                  {connection.normalizedProfile.metrics30d.map((metric) => (
                    <div
                      key={metric.metric}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {formatGoogleBusinessProfileLabel(metric.metric) ?? metric.metric}
                        </p>
                        <p className="text-muted-foreground">
                          {metric.startDate} to {metric.endDate}
                        </p>
                      </div>
                      <Badge variant="outline">{metric.total}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No performance metrics were returned for the last 30 days.</p>
              )}
            </div>
          </SectionPanel>

          <SectionPanel
            title="Recent reviews"
            description="Review snippets and aggregate rating imported from Google."
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {typeof connection?.normalizedProfile?.rating === 'number' ? (
                <Badge variant="outline">Rating {connection.normalizedProfile.rating.toFixed(1)}</Badge>
              ) : null}
              {typeof connection?.normalizedProfile?.reviewCount === 'number' ? (
                <Badge variant="outline">{connection.normalizedProfile.reviewCount} reviews</Badge>
              ) : null}
            </div>
            <ReviewsList reviews={connection?.normalizedProfile?.reviewSnippets ?? []} />
          </SectionPanel>

          <SectionPanel
            title="Media"
            description="Media items returned from Google Business Profile for the selected location."
          >
            <MediaList media={connection?.normalizedProfile?.media ?? []} />
          </SectionPanel>
        </div>
      </div>
    </SettingsCard>
  );
}
