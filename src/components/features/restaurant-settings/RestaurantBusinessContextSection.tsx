'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { opsHref } from '@/lib/url/opsHref';

import { DISCOVERY_SECTION_ORDER, TAB_LABELS, type FamilyKey } from './businessContextModel';
import { DiscoveryPanelsFrame } from './discovery/DiscoveryPanelsFrame';
import { buildDiscoverySummary } from './discovery/discoverySummary';
import { useDiscoveryGbpDraftOverrides } from './discovery/hooks';
import {
  AttributesPanel,
  BusinessDetailsPanel,
  CategoriesPanel,
  LinksPanel,
  ServiceAreasPanel,
  ServiceItemsPanel,
} from './discovery/panels';
import { GbpDriftBadge, useWorkspaceGbpDriftCheck } from './gbpDriftBadges';
import {
  getGbpDriftSectionBadge,
  useGbpDriftSectionStatus,
  useGbpDriftStatus,
} from './GbpDriftProvider';
import { SettingsCard } from './shared/SettingsCard';
import { SettingsSectionStates } from './shared/settingsSectionStates';
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

export function RestaurantBusinessContextSection({
  restaurantId,
  embedded = false,
  onDirtyChange,
}: RestaurantBusinessContextSectionProps) {
  const editor = useRestaurantBusinessContextEditor({ restaurantId, onDirtyChange });
  const { contextQuery } = editor;
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

  useDiscoveryGbpDraftOverrides({ editor, gbpDriftFieldsByFamily });

  const summary = buildDiscoverySummary(editor);
  return (
    <SettingsSectionStates
      restaurantId={restaurantId}
      isLoading={contextQuery.isLoading && !contextQuery.data}
      error={contextQuery.error}
      noRestaurant={
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
      }
      loading={
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
      }
      errorState={(loadError) => (
        <DiscoveryFrame
          embedded={embedded}
          title="Public discovery"
          description="Manage the categories, online links, and public discovery details used to describe this restaurant."
        >
          <Alert variant="destructive">
            <AlertTitle>Unable to load discovery details</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{loadError.message}</span>
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
      )}
    >
      {() => (
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
                    When a section has no saved values yet, it may be pre-filled from Google so you
                    can review it before saving.
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
      )}
    </SettingsSectionStates>
  );
}
