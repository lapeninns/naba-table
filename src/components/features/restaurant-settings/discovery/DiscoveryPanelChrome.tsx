'use client';

import { RotateCcw } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { opsHref } from '@/lib/url/opsHref';

import { type FamilyKey, type SeedSource } from '../businessContextModel';
import {
  buildDiscoverySaveBoundaryState,
  formatDiscoveryStatus,
  getDiscoverySyncPosture,
} from './discoveryPanelChromeDomain';
import { useOptionalGbpDrift } from '../gbp-drift/useGbpDrift';

import type { RestaurantBusinessContextEditor } from '../useRestaurantBusinessContextEditor';
import type { ReactNode } from 'react';

export function DiscoveryStatusLine({
  family,
  coreCount,
  providerCount,
  seedSource,
  gbpLinked,
}: {
  family: FamilyKey;
  coreCount: number;
  providerCount: number;
  seedSource: SeedSource[FamilyKey];
  gbpLinked: boolean;
}) {
  const status = formatDiscoveryStatus({ coreCount, providerCount, seedSource, gbpLinked });

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <Text variant="label">{getDiscoverySyncPosture(family)}</Text>
      <Text variant="caption">
        {gbpLinked ? (
          status
        ) : (
          <>
            Saved {coreCount} ·{' '}
            <Link
              href={opsHref('/settings/restaurant/google-business-profile#gbp-connection')}
              className="underline"
            >
              Connect Google Business Profile to import suggestions
            </Link>
          </>
        )}
      </Text>
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
  const state = buildDiscoverySaveBoundaryState({
    family,
    dirty: editor.dirty[family],
    saved: editor.savedFamily === family,
    hasError: Boolean(editor.errors[family]),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.dirty ? <Badge variant="secondary">Dirty</Badge> : null}
      {state.saved ? (
        <Badge variant="outline" role="status">
          Saved
        </Badge>
      ) : null}
      {state.hasError ? <Badge variant="destructive">Error</Badge> : null}
      <Text as="span" variant="caption">{state.boundaryText}</Text>
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
  const drift = useOptionalGbpDrift();
  const gbpLinked = drift ? drift.isLinked : editor.providerCounts[family] > 0;

  return (
    <DiscoveryStatusLine
      family={family}
      coreCount={editor.coreCounts[family]}
      providerCount={editor.providerCounts[family]}
      seedSource={editor.seedSource[family]}
      gbpLinked={gbpLinked}
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
    <Text
      variant="caption"
      className="text-destructive"
      role="alert"
      aria-live="assertive"
      data-discovery-family-error={family}
      tabIndex={-1}
    >
      {message}
    </Text>
  ) : null;
}
