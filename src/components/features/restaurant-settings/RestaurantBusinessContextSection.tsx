'use client';

import Link from 'next/link';
import { useEffect, useMemo, type ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { opsHref } from '@/lib/url/opsHref';

import {
  DISCOVERY_SECTION_ORDER,
  TAB_LABELS,
  buildBusinessContextFamilyPayload,
  type FamilyKey,
} from './businessContextModel';
import { useOptionalGbpDrift } from './gbp-drift/useGbpDrift';
import { GbpDriftBadge, slugifyDualSyncDisplay, useWorkspaceGbpDriftCheck } from './gbpDriftBadges';
import {
  getGbpDriftSectionBadge,
  useGbpDriftSectionStatus,
  useGbpDriftStatus,
} from './GbpDriftProvider';
import {
  AttributesPanel,
  BusinessDetailsPanel,
  CategoriesPanel,
  DiscoveryPanelsFrame,
  LinksPanel,
  ServiceAreasPanel,
  ServiceItemsPanel,
} from './RestaurantBusinessContextPanels';
import { SettingsCard } from './shared/SettingsCard';
import { useRestaurantBusinessContextEditor } from './useRestaurantBusinessContextEditor';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type RestaurantBusinessContextSectionProps = {
  restaurantId: string | null;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
};

function DiscoveryFrame({
  embedded,
  title,
  description,
  children,
}: {
  embedded: boolean;
  title: string;
  description: string;
  children: ReactNode;
}) {
  if (embedded) {
    return <div className="space-y-6">{children}</div>;
  }

  return (
    <SettingsCard title={title} description={description}>
      {children}
    </SettingsCard>
  );
}

function suffixAfter(fieldKey: string, prefix: string) {
  return fieldKey.startsWith(prefix) ? fieldKey.slice(prefix.length) : null;
}

export function RestaurantBusinessContextSection({
  restaurantId,
  embedded = false,
  onDirtyChange,
}: RestaurantBusinessContextSectionProps) {
  const editor = useRestaurantBusinessContextEditor({ restaurantId, onDirtyChange });
  const { contextQuery } = editor;
  const registryDrift = useOptionalGbpDrift();
  const registerDriftDraftOverride = registryDrift?.registerDraftOverride;
  const { reviewHref } = useGbpDriftStatus();
  const discoveryGbpStatus = useGbpDriftSectionStatus([
    'businessContext.categories',
    'businessContext.serviceAreas',
    'businessContext.attributes',
    'businessContext.serviceItems',
  ]);
  const discoveryGbpBadge = getGbpDriftSectionBadge(discoveryGbpStatus);
  const gbpDrift = useWorkspaceGbpDriftCheck({
    restaurantId,
    sectionKeys: [
      'businessContext.categories',
      'businessContext.serviceAreas',
      'businessContext.attributes',
      'businessContext.serviceItems',
    ],
  });
  const gbpDriftFieldsByFamily = useMemo<Record<FamilyKey, ReadonlyArray<DualSyncFieldSummary>>>(
    () => ({
      businessDetails: [],
      links: [],
      categories: gbpDrift.getFieldsBySection('businessContext.categories'),
      serviceAreas: gbpDrift.getFieldsBySection('businessContext.serviceAreas'),
      attributes: gbpDrift.getFieldsBySection('businessContext.attributes'),
      serviceItems: gbpDrift.getFieldsBySection('businessContext.serviceItems'),
    }),
    [gbpDrift],
  );

  const discoveryDraftOverrides = useMemo(() => {
    const entries: Array<readonly [string, unknown]> = [];
    const payloadState = {
      businessDetails: editor.businessDetails,
      links: editor.links,
      categories: editor.categories,
      serviceAreas: editor.serviceAreas,
      attributes: editor.attributes,
      serviceItems: editor.serviceItems,
    };

    try {
      const payload = buildBusinessContextFamilyPayload('categories', payloadState);
      for (const field of gbpDriftFieldsByFamily.categories) {
        const slug = suffixAfter(field.fieldKey, 'businessContext.categories.');
        if (!slug) continue;
        entries.push([
          field.fieldKey,
          payload.categories?.find((row) => slugifyDualSyncDisplay(row.displayName) === slug),
        ]);
      }
    } catch {
      // Invalid in-progress editor payloads should not break the settings route.
    }

    try {
      const payload = buildBusinessContextFamilyPayload('serviceAreas', payloadState);
      for (const field of gbpDriftFieldsByFamily.serviceAreas) {
        const slug = suffixAfter(field.fieldKey, 'businessContext.serviceAreas.');
        if (!slug) continue;
        entries.push([
          field.fieldKey,
          payload.serviceAreas?.find((row) => slugifyDualSyncDisplay(row.displayName) === slug),
        ]);
      }
    } catch {
      // Invalid in-progress editor payloads should not break the settings route.
    }

    try {
      const payload = buildBusinessContextFamilyPayload('attributes', payloadState);
      for (const field of gbpDriftFieldsByFamily.attributes) {
        const attributeKey = suffixAfter(field.fieldKey, 'businessContext.attributes.');
        if (!attributeKey) continue;
        entries.push([
          field.fieldKey,
          payload.attributes?.find((row) => row.attributeKey === attributeKey),
        ]);
      }
    } catch {
      // Invalid in-progress editor payloads should not break the settings route.
    }

    try {
      const payload = buildBusinessContextFamilyPayload('serviceItems', payloadState);
      for (const field of gbpDriftFieldsByFamily.serviceItems) {
        const itemKey = suffixAfter(field.fieldKey, 'businessContext.serviceItems.');
        if (!itemKey) continue;
        entries.push([
          field.fieldKey,
          payload.serviceItems?.find((row) => row.itemKey === itemKey),
        ]);
      }
    } catch {
      // Invalid in-progress editor payloads should not break the settings route.
    }

    return entries;
  }, [
    editor.attributes,
    editor.businessDetails,
    editor.categories,
    editor.links,
    editor.serviceAreas,
    editor.serviceItems,
    gbpDriftFieldsByFamily.attributes,
    gbpDriftFieldsByFamily.categories,
    gbpDriftFieldsByFamily.serviceAreas,
    gbpDriftFieldsByFamily.serviceItems,
  ]);

  useEffect(() => {
    if (!registerDriftDraftOverride) return;
    for (const [fieldKey, value] of discoveryDraftOverrides) {
      registerDriftDraftOverride(fieldKey, value);
    }
  }, [discoveryDraftOverrides, registerDriftDraftOverride]);

  const summary = useMemo(() => {
    const dirtyFamilies = DISCOVERY_SECTION_ORDER.filter((f) => editor.dirty[f]);
    const errorFamilies = DISCOVERY_SECTION_ORDER.filter((f) => editor.errors[f]);

    let nextFamily: FamilyKey | null = null;
    for (const f of DISCOVERY_SECTION_ORDER) {
      if (editor.errors[f]) {
        nextFamily = f;
        break;
      }
      if (editor.dirty[f]) {
        nextFamily = f;
        break;
      }
      if (editor.seedSource[f] === 'provider') {
        nextFamily = f;
        break;
      }
      if (editor.coreCounts[f] === 0) {
        nextFamily = f;
        break;
      }
    }
    if (!nextFamily && editor.activeTab) {
      nextFamily = editor.activeTab;
    }

    return {
      dirtyCount: dirtyFamilies.length,
      errorCount: errorFamilies.length,
      activeFamily: editor.activeTab,
      nextFamily,
    };
  }, [editor.dirty, editor.errors, editor.activeTab, editor.seedSource, editor.coreCounts]);
  if (!restaurantId) {
    return (
      <DiscoveryFrame
        embedded={embedded}
        title="Public discovery"
        description="Select a restaurant to manage categories, online links, and public discovery details."
      >
        <p className="text-sm text-muted-foreground">
          Choose a restaurant using the sidebar switcher to manage how guests find and understand
          it.
        </p>
      </DiscoveryFrame>
    );
  }

  if (contextQuery.isLoading && !contextQuery.data) {
    return (
      <DiscoveryFrame
        embedded={embedded}
        title="Public discovery"
        description="Loading the public discovery details for this restaurant."
      >
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DiscoveryFrame>
    );
  }

  if (contextQuery.error) {
    return (
      <DiscoveryFrame
        embedded={embedded}
        title="Public discovery"
        description="Manage the categories, online links, and public discovery details used to describe this restaurant."
      >
        <Alert variant="destructive">
          <AlertTitle>Unable to load discovery details</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{contextQuery.error.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => contextQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </DiscoveryFrame>
    );
  }

  return (
    <DiscoveryFrame
      embedded={embedded}
      title="Public discovery"
      description="Manage the details that help guests and profile providers describe this restaurant accurately."
    >
      <div className="space-y-6">
        {embedded ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Google suggestions are optional; compare the latest source data in the{' '}
            <Link
              href={opsHref('/settings/restaurant/google-business-profile')}
              className="underline"
            >
              Google Business Profile page
            </Link>
            .
          </p>
        ) : (
          <Alert>
            <AlertTitle>About Google suggestions</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Google is optional. Use it to import or compare public details faster.</p>
              <p>
                Edits here become this restaurant’s saved profile details. The{' '}
                <Link
                  href={opsHref('/settings/restaurant/google-business-profile')}
                  className="underline"
                >
                  Google Business Profile page
                </Link>{' '}
                shows Google’s latest version when you want to compare or update it.
              </p>
              <p className="text-xs text-muted-foreground">
                When a section has no saved values yet, it may be pre-filled from Google so you can
                review it before saving.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5 text-sm">
          <span className="font-medium text-foreground">
            {summary.activeFamily ? TAB_LABELS[summary.activeFamily] : 'No section open'}
          </span>
          {summary.dirtyCount > 0 ? (
            <Badge variant="secondary">{summary.dirtyCount} dirty</Badge>
          ) : null}
          <GbpDriftBadge
            fields={DISCOVERY_SECTION_ORDER.flatMap((family) => gbpDriftFieldsByFamily[family])}
            label="Google discovery review"
          />
          {summary.errorCount > 0 ? (
            <Badge variant="destructive">
              {summary.errorCount} error{summary.errorCount !== 1 ? 's' : ''}
            </Badge>
          ) : null}
          {discoveryGbpBadge ? (
            <Button asChild variant="outline" size="sm" className="h-7">
              <Link href={reviewHref}>
                <Badge variant="metric">{discoveryGbpBadge}</Badge>
                Review Google
              </Link>
            </Button>
          ) : null}
          {summary.nextFamily && summary.nextFamily !== summary.activeFamily ? (
            <span className="text-xs text-muted-foreground">
              Next to review: {TAB_LABELS[summary.nextFamily]}
            </span>
          ) : summary.dirtyCount === 0 && summary.errorCount === 0 ? (
            <span className="text-xs text-muted-foreground">All sections up to date</span>
          ) : null}
        </div>

        <DiscoveryPanelsFrame
          embedded={embedded}
          activeTab={editor.activeTab}
          onActiveTabChange={editor.setActiveTab}
          editor={editor}
          gbpDriftFieldsByFamily={gbpDriftFieldsByFamily}
        >
          <BusinessDetailsPanel family="businessDetails" embedded={embedded} editor={editor} />
          <LinksPanel family="links" embedded={embedded} editor={editor} />
          <CategoriesPanel family="categories" embedded={embedded} editor={editor} />
          <ServiceAreasPanel family="serviceAreas" embedded={embedded} editor={editor} />
          <AttributesPanel family="attributes" embedded={embedded} editor={editor} />
          <ServiceItemsPanel family="serviceItems" embedded={embedded} editor={editor} />
        </DiscoveryPanelsFrame>
      </div>
    </DiscoveryFrame>
  );
}
