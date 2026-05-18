'use client';

import { RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  SYNC_POSTURE,
  formatSeedSource,
  type FamilyKey,
  type SeedSource,
} from '../businessContextModel';

import type { RestaurantBusinessContextEditor } from '../useRestaurantBusinessContextEditor';
import type { ReactNode } from 'react';

const DISCOVERY_SAVE_BOUNDARIES: Record<FamilyKey, string> = {
  businessDetails: 'This saves profile basics only.',
  links: 'This saves discovery links only.',
  categories: 'This saves dining categories only.',
  serviceAreas: 'This saves service areas only.',
  attributes: 'This saves amenities only.',
  serviceItems: 'This saves services only.',
};

export function DiscoveryStatusLine({
  family,
  coreCount,
  providerCount,
  seedSource,
}: {
  family: FamilyKey;
  coreCount: number;
  providerCount: number;
  seedSource: SeedSource[FamilyKey];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-foreground">{SYNC_POSTURE[family]}</p>
      <p className="text-xs text-muted-foreground">
        Saved {coreCount} · Suggested {providerCount} ·{' '}
        {formatSeedSource(seedSource, providerCount)}
      </p>
    </div>
  );
}

export function DiscoverySaveBoundary({
  family,
  editor,
}: {
  family: FamilyKey;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {editor.dirty[family] ? <Badge variant="secondary">Dirty</Badge> : null}
      {editor.savedFamily === family ? (
        <Badge variant="outline" role="status">
          Saved
        </Badge>
      ) : null}
      {editor.errors[family] ? <Badge variant="destructive">Error</Badge> : null}
      <span className="text-xs text-muted-foreground">{DISCOVERY_SAVE_BOUNDARIES[family]}</span>
    </div>
  );
}

export function FamilyStatus({
  family,
  editor,
}: {
  family: FamilyKey;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <DiscoveryStatusLine
      family={family}
      coreCount={editor.coreCounts[family]}
      providerCount={editor.providerCounts[family]}
      seedSource={editor.seedSource[family]}
    />
  );
}

export function FamilyActions({
  family,
  editor,
  saveLabel,
  children,
}: {
  family: FamilyKey;
  editor: RestaurantBusinessContextEditor;
  saveLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <DiscoverySaveBoundary family={family} editor={editor} />
      {children}
      <Button
        type="button"
        variant="outline"
        onClick={() => editor.resetFamily(family)}
        disabled={!editor.dirty[family]}
      >
        <RotateCcw className="size-4" />
        Reset draft
      </Button>
      <Button
        type="button"
        onClick={() => void editor.saveFamily(family)}
        disabled={!editor.dirty[family] || editor.savingFamily === family}
      >
        {saveLabel}
      </Button>
    </div>
  );
}

export function FamilyError({
  family,
  editor,
}: {
  family: FamilyKey;
  editor: RestaurantBusinessContextEditor;
}) {
  const message = editor.errors[family];
  // RP-UX-07: announce family save failures so screen readers and live-region
  // listeners can react and operators can recover without re-reading the page.
  return message ? (
    <p
      className="text-sm text-destructive"
      role="alert"
      aria-live="assertive"
      data-discovery-family-error={family}
      tabIndex={-1}
    >
      {message}
    </p>
  ) : null;
}
