'use client';

import { AlertCircle, ExternalLink, Info, Link2, Loader2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { SettingsDialog } from '../../shared';
import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from '../googleBusinessProfileConnectionModel';

import type { GoogleBusinessProfileAvailableLocation } from '@/services/ops/restaurants';

export type GbpLocationChooserDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly connectedAccount: string | null;
  readonly locations: ReadonlyArray<GoogleBusinessProfileAvailableLocation>;
  readonly locationsArePossiblyStale: boolean;
  readonly isLoadingLocations: boolean;
  readonly selectedLocation: GoogleBusinessProfileAvailableLocation | null;
  readonly selectedLocationValue: string;
  readonly onSelectedLocationValueChange: (value: string) => void;
  readonly hasLinkedLocation: boolean;
  readonly onLinkLocation: () => void;
  readonly isLinking: boolean;
  /** The last link attempt failed; shown inside the dialog so it is not hidden behind it. */
  readonly linkErrorMessage: string | null;
};

export function GbpLocationChooserDialog({
  open,
  onOpenChange,
  connectedAccount,
  locations,
  locationsArePossiblyStale,
  isLoadingLocations,
  selectedLocation,
  selectedLocationValue,
  onSelectedLocationValueChange,
  hasLinkedLocation,
  onLinkLocation,
  isLinking,
  linkErrorMessage,
}: GbpLocationChooserDialogProps) {
  const previewHref = buildGoogleMapsPlaceHref(selectedLocation?.placeId);

  return (
    <SettingsDialog
      open={open}
      onOpenChange={(next) => {
        if (!isLinking) onOpenChange(next);
      }}
      title="Choose a Business Profile location"
      description={
        connectedAccount
          ? `Signed in as ${connectedAccount}. Only listings this Google account can manage are shown.`
          : 'Only listings your Google account can manage are shown.'
      }
      testId="gbp-location-chooser"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLinking}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onLinkLocation}
            disabled={isLinking || !selectedLocation}
            aria-busy={isLinking || undefined}
          >
            {isLinking ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : (
              <Link2 data-icon="inline-start" aria-hidden />
            )}
            {isLinking ? 'Linking…' : hasLinkedLocation ? 'Link this location' : 'Link location'}
          </Button>
        </>
      }
    >
      {linkErrorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Location link failed</AlertTitle>
          <AlertDescription className="break-words">
            {linkErrorMessage} The current link is unchanged. Try again or choose another listing.
          </AlertDescription>
        </Alert>
      ) : null}
      {locations.length === 0 ? (
        isLoadingLocations ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading your Google listings…
          </p>
        ) : (
          <Alert>
            <Info className="size-4" aria-hidden />
            <AlertTitle>No accessible locations</AlertTitle>
            <AlertDescription>
              Google is connected, but this account does not manage any Business Profile locations.
            </AlertDescription>
          </Alert>
        )
      ) : (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-foreground">
            {locationsArePossiblyStale
              ? 'Available locations (possibly stale)'
              : 'Available locations'}
          </legend>
          {locations.map((location) => {
            const value = buildLocationValue(location);
            const inputId = `gbp-location-${location.accountId}-${location.locationId}`;
            return (
              <Label
                key={value}
                htmlFor={inputId}
                className="flex min-w-0 cursor-pointer items-start gap-3 rounded-md border border-border/70 p-3 has-[:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring [@media(pointer:coarse)]:min-h-11"
              >
                <Input
                  id={inputId}
                  type="radio"
                  name="gbp-location"
                  value={value}
                  checked={selectedLocationValue === value}
                  onChange={() => onSelectedLocationValueChange(value)}
                  className="mt-1 size-4 shrink-0 p-0 accent-primary shadow-none"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {location.title ?? location.locationId}
                  </span>
                  <span className="break-words text-xs text-muted-foreground">
                    {[location.addressText ?? 'Address not available', location.accountDisplayName]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </Label>
            );
          })}
        </fieldset>
      )}
      {previewHref ? (
        <Button type="button" variant="link" asChild className="h-auto self-start px-0">
          <a href={previewHref} target="_blank" rel="noreferrer">
            <ExternalLink data-icon="inline-start" aria-hidden />
            Preview the selected listing on Google
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      ) : null}
    </SettingsDialog>
  );
}
