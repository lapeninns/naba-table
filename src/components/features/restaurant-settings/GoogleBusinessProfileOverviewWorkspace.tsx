'use client';

import { ExternalLink, Link2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { GoogleBusinessProfilePanel } from './GoogleBusinessProfilePanel';

import type {
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

type GoogleBusinessProfileSummaryItemProps = {
  label: string;
  value: string;
  detail?: string | null;
};

export function GoogleBusinessProfileSummaryItem({
  label,
  value,
  detail,
}: GoogleBusinessProfileSummaryItemProps) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

type GoogleBusinessProfileOverviewWorkspaceProps = {
  data: GoogleBusinessProfileConnection;
  selectedLocation: GoogleBusinessProfileAvailableLocation | null;
  selectedLocationValue: string;
  onSelectedLocationValueChange: (value: string) => void;
  buildLocationValue: (location: GoogleBusinessProfileAvailableLocation) => string;
  onLinkLocation: () => void;
  isLinking: boolean;
  hasLinkedLocation: boolean;
};

export function GoogleBusinessProfileOverviewWorkspace({
  data,
  selectedLocation,
  selectedLocationValue,
  onSelectedLocationValueChange,
  buildLocationValue,
  onLinkLocation,
  isLinking,
  hasLinkedLocation,
}: GoogleBusinessProfileOverviewWorkspaceProps) {
  const hasAvailableLocations = data.availableLocations.length > 0;

  return (
    <GoogleBusinessProfilePanel
      title="Connection & location"
      description="Choose the exact Google Business Profile location that belongs to this restaurant, then keep one linked source of truth for review and sync."
    >
      <div className="space-y-5">
        {data.connectedGoogleEmail ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Authorized as{' '}
              <span className="font-medium text-foreground">{data.connectedGoogleEmail}</span>.
            </p>
          </div>
        ) : (
          <Alert>
            <AlertTitle>Google account not connected yet</AlertTitle>
            <AlertDescription>
              Start with <span className="font-medium text-foreground">Connect Google</span> in the
              header to discover available Business Profile accounts and locations.
            </AlertDescription>
          </Alert>
        )}

        {data.isConfigured && data.connectedGoogleEmail && !hasAvailableLocations ? (
          <Alert>
            <AlertTitle>No accessible GBP locations found</AlertTitle>
            <AlertDescription>
              Authorization succeeded, but this Google account does not currently expose any
              Business Profile locations to Nabatable.
            </AlertDescription>
          </Alert>
        ) : null}

        {hasAvailableLocations ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Available locations</p>
              <Select value={selectedLocationValue} onValueChange={onSelectedLocationValueChange}>
                <SelectTrigger
                  className="w-full"
                  aria-label="Select a Google Business Profile location"
                >
                  <SelectValue placeholder="Select a Google Business Profile location" />
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
              <div className="space-y-4 rounded-2xl border border-border/60 bg-background p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <GoogleBusinessProfileSummaryItem
                    label="Business"
                    value={selectedLocation.title ?? selectedLocation.locationId}
                  />
                  <GoogleBusinessProfileSummaryItem
                    label="Account"
                    value={selectedLocation.accountDisplayName ?? selectedLocation.accountId}
                  />
                  <GoogleBusinessProfileSummaryItem
                    label="Address"
                    value={selectedLocation.addressText ?? 'Address unavailable'}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={onLinkLocation}
                    disabled={!selectedLocation || isLinking}
                  >
                    <Link2 className="size-4" />
                    {isLinking
                      ? 'Saving link...'
                      : hasLinkedLocation
                        ? 'Relink location'
                        : 'Link location'}
                  </Button>

                  {selectedLocation?.placeId ? (
                    <Button type="button" variant="outline" asChild>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(selectedLocation.placeId)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="size-4" />
                        Open in Google Maps
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </GoogleBusinessProfilePanel>
  );
}
