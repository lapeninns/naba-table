'use client';

import { ExternalLink, PencilLine, RefreshCcw } from 'lucide-react';

import {
  SETTINGS_COMPACT_ACTION_BAR_CLASS,
  SettingsSecondaryActions,
} from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { formatGbpDateTime } from '../lib/formatters';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

type LinkedSummaryCardProps = {
  data: GoogleBusinessProfileConnection;
  manageOnGoogleHref: string | null;
  onGenerateDraft: () => void;
  onChangeLocation: () => void;
  isGeneratingDraft: boolean;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

export function LinkedSummaryCard({
  data,
  manageOnGoogleHref,
  onGenerateDraft,
  onChangeLocation,
  isGeneratingDraft,
}: LinkedSummaryCardProps) {
  const hasSyncError = data.status === 'sync_error';
  const multipleLocations = data.availableLocations.length > 1;
  const hasSecondaryActions = Boolean(manageOnGoogleHref) || multipleLocations;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {data.externalLocationTitle ?? 'Linked location'}
        </CardTitle>
        <CardDescription>
          {data.connectedGoogleEmail ? (
            <>
              Linked through{' '}
              <span className="font-medium text-foreground">{data.connectedGoogleEmail}</span>.
              Generate a review draft before publishing any Business Profile changes.
            </>
          ) : (
            'Nabatable keeps a cached snapshot of this Business Profile for verification.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {hasSyncError && data.lastError ? (
          <Alert variant="destructive">
            <AlertTitle>Sync needs attention</AlertTitle>
            <AlertDescription>{data.lastError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow label="Location ID" value={data.externalLocationId ?? 'Unknown'} />
          <DetailRow label="Provider timezone" value={data.providerTimezone ?? 'Inherited'} />
          <DetailRow label="Last fetched" value={formatGbpDateTime(data.lastPullAt) ?? 'Never'} />
          <DetailRow label="Last pushed" value={formatGbpDateTime(data.lastPushAt) ?? 'Never'} />
        </div>

        <div className={SETTINGS_COMPACT_ACTION_BAR_CLASS}>
          <Button type="button" onClick={onGenerateDraft} disabled={isGeneratingDraft} size="sm">
            <RefreshCcw
              data-icon="inline-start"
              className={cn(isGeneratingDraft && 'animate-spin')}
              aria-hidden
            />
            {isGeneratingDraft ? 'Generating...' : 'Generate review draft'}
          </Button>

          {hasSecondaryActions ? (
            <SettingsSecondaryActions label="More Google actions">
              {manageOnGoogleHref ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={manageOnGoogleHref} target="_blank" rel="noreferrer">
                    <ExternalLink data-icon="inline-start" aria-hidden />
                    View on Google Maps
                  </a>
                </Button>
              ) : null}

              {multipleLocations ? (
                <Button type="button" variant="ghost" size="sm" onClick={onChangeLocation}>
                  <PencilLine data-icon="inline-start" aria-hidden />
                  Change location
                </Button>
              ) : null}
            </SettingsSecondaryActions>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
