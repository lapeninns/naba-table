'use client';

import { ExternalLink, PencilLine, RefreshCcw } from 'lucide-react';

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
    <div className="space-y-0.5">
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
      <CardContent className="space-y-5">
        {hasSyncError && data.lastError ? (
          <Alert variant="destructive">
            <AlertTitle>Sync needs attention</AlertTitle>
            <AlertDescription>{data.lastError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-3">
          <DetailRow
            label="Location ID"
            value={data.externalLocationId ?? 'Unknown'}
          />
          <DetailRow
            label="Last fetched"
            value={formatGbpDateTime(data.lastPullAt) ?? 'Never'}
          />
          <DetailRow
            label="Last pushed"
            value={formatGbpDateTime(data.lastPushAt) ?? 'Never'}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onGenerateDraft} disabled={isGeneratingDraft} size="lg">
            <RefreshCcw className={cn('mr-2 size-4', isGeneratingDraft && 'animate-spin')} />
            {isGeneratingDraft ? 'Generating...' : 'Generate review draft'}
          </Button>

          {manageOnGoogleHref ? (
            <Button type="button" variant="outline" asChild>
              <a href={manageOnGoogleHref} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-4" />
                View on Google Maps
              </a>
            </Button>
          ) : null}

          {multipleLocations ? (
            <Button type="button" variant="ghost" onClick={onChangeLocation}>
              <PencilLine className="mr-2 size-4" />
              Change location
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
