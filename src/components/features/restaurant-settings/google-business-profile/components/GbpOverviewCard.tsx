'use client';

import { ExternalLink, MapPin, RefreshCcw, Unplug } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { StatusBadge, connectionStatusBadge } from './StatusBadge';
import { formatLastSync } from '../lib/formatters';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

type GbpOverviewCardProps = {
  status: GoogleBusinessProfileConnection['status'];
  stageLabel: string;
  locationTitle: string;
  accountLabel: string;
  lastPullAt: string | null;
  hasLinkedLocation: boolean;
  showConnect: boolean;
  connectHref: string;
  showPicker: boolean;
  onChooseLocation: () => void;
  canRefresh: boolean;
  onRefresh: (() => void) | null;
  isRefreshing: boolean;
  manageOnGoogleHref: string | null;
  canDisconnect: boolean;
  onRequestDisconnect: (() => void) | null;
  isDisconnecting: boolean;
};

function OverviewDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-background px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium leading-5 text-foreground break-words">{value}</p>
    </div>
  );
}

export function GbpOverviewCard({
  status,
  stageLabel,
  locationTitle,
  accountLabel,
  lastPullAt,
  hasLinkedLocation,
  showConnect,
  connectHref,
  showPicker,
  onChooseLocation,
  canRefresh,
  onRefresh,
  isRefreshing,
  manageOnGoogleHref,
  canDisconnect,
  onRequestDisconnect,
  isDisconnecting,
}: GbpOverviewCardProps) {
  const badge = connectionStatusBadge(status);
  const hasActions =
    showConnect ||
    showPicker ||
    (canRefresh && onRefresh) ||
    manageOnGoogleHref ||
    (canDisconnect && onRequestDisconnect);

  return (
    <Card data-testid="gbp-overview-card" variant="compact" className="border-border/70 shadow-sm">
      <CardHeader className="gap-3 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={badge.tone} label={badge.label} />
              <Badge variant={hasLinkedLocation ? 'secondary' : 'outline'}>
                {hasLinkedLocation ? 'Location mapped' : 'No location mapped'}
              </Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl leading-tight">GBP overview</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6">
                {stageLabel}. Google is optional; use it when you want faster imports or a listing
                comparison.
              </CardDescription>
            </div>
          </div>

          {hasActions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {showConnect ? (
                <Button type="button" size="sm" asChild>
                  <Link href={connectHref}>Connect Google</Link>
                </Button>
              ) : null}
              {showPicker ? (
                <Button type="button" size="sm" onClick={onChooseLocation}>
                  <MapPin data-icon="inline-start" />
                  Choose location
                </Button>
              ) : null}
              {canRefresh && onRefresh ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
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
              {canDisconnect && onRequestDisconnect ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRequestDisconnect}
                  disabled={isDisconnecting}
                >
                  <Unplug data-icon="inline-start" />
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="border-t border-border/60 bg-muted/20 px-4 py-4 sm:px-5">
        <dl className="grid gap-3 md:grid-cols-3">
          <OverviewDatum label="Business location" value={locationTitle} />
          <OverviewDatum label="Google account" value={accountLabel} />
          <OverviewDatum label="Last checked" value={formatLastSync(lastPullAt)} />
        </dl>
      </CardContent>
    </Card>
  );
}
