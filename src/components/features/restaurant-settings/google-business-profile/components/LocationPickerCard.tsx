'use client';

import { ExternalLink, Link2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from '../googleBusinessProfileConnectionModel';

import type {
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

type LocationPickerCardProps = {
  data: GoogleBusinessProfileConnection;
  onConnect: () => void;
  isConnecting: boolean;
  selectedLocation: GoogleBusinessProfileAvailableLocation | null;
  selectedLocationValue: string;
  onSelectedLocationValueChange: (value: string) => void;
  onLinkLocation: () => void;
  isLinking: boolean;
  hasLinkedLocation: boolean;
  locationsErrorMessage: string | null;
  onRetryLocations: (() => void) | null;
  isRetryingLocations: boolean;
  locationsArePossiblyStale: boolean;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

export function LocationPickerCard({
  data,
  onConnect,
  isConnecting,
  selectedLocation,
  selectedLocationValue,
  onSelectedLocationValueChange,
  onLinkLocation,
  isLinking,
  hasLinkedLocation,
  locationsErrorMessage,
  onRetryLocations,
  isRetryingLocations,
  locationsArePossiblyStale,
}: LocationPickerCardProps) {
  const needsReauth = data.status === 'reauth_required';
  const hasLocations = data.availableLocations.length > 0;
  const selectedLocationGoogleHref = buildGoogleMapsPlaceHref(selectedLocation?.placeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a Business Profile location</CardTitle>
        <CardDescription>
          {data.connectedGoogleEmail ? (
            <>
              Authorized as{' '}
              <span className="font-medium text-foreground">{data.connectedGoogleEmail}</span>.
            </>
          ) : (
            'Authorize a Google account to discover available locations.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {needsReauth ? (
          <Alert variant="destructive">
            <AlertTitle>Reconnect required</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                The existing Google authorization can no longer be used. Reconnect to restore sync
                access.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onConnect}
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Reconnect Google'}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {locationsErrorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Location refresh failed</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{locationsErrorMessage}</span>
              {onRetryLocations ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRetryLocations}
                  disabled={isRetryingLocations}
                >
                  {isRetryingLocations ? 'Retrying...' : 'Retry locations'}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {!hasLocations ? (
          <Alert>
            <AlertTitle>No accessible locations</AlertTitle>
            <AlertDescription>
              Authorization succeeded, but this Google account does not currently expose any
              Business Profile locations.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="gbp-location-select" className="text-sm font-medium text-foreground">
                {locationsArePossiblyStale
                  ? 'Available locations (possibly stale)'
                  : 'Available locations'}
              </Label>
              <Select value={selectedLocationValue} onValueChange={onSelectedLocationValueChange}>
                <SelectTrigger id="gbp-location-select" className="w-full">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {data.availableLocations.map((location) => (
                    <SelectItem
                      key={buildLocationValue(location)}
                      value={buildLocationValue(location)}
                    >
                      {location.title ?? location.locationId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLocation ? (
              <div className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <DetailRow
                    label="Business"
                    value={selectedLocation.title ?? selectedLocation.locationId}
                  />
                  <DetailRow
                    label="Account"
                    value={selectedLocation.accountDisplayName ?? selectedLocation.accountId}
                  />
                  <DetailRow
                    label="Address"
                    value={selectedLocation.addressText ?? 'Not available'}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={onLinkLocation} disabled={isLinking}>
                    <Link2 data-icon="inline-start" />
                    {isLinking
                      ? 'Linking...'
                      : hasLinkedLocation
                        ? 'Relink location'
                        : 'Link location'}
                  </Button>
                  {selectedLocationGoogleHref ? (
                    <Button type="button" variant="outline" asChild>
                      <a href={selectedLocationGoogleHref} target="_blank" rel="noreferrer">
                        <ExternalLink data-icon="inline-start" />
                        Preview on Google
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
