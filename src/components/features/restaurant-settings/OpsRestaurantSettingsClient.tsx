'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { opsHref } from '@/lib/url/opsHref';

import { AVAILABILITY_ANCHORS, availabilityHash } from './availabilityAnchors';
import { SETTINGS_COMPACT_ROUTE_STACK_CLASS } from './shared';
import { useRestaurantSettingsContext } from './shell/useRestaurantSettingsContext';

import type { AvailabilitySettingsWorkspace } from './routes';
import type { RestaurantSettingsView } from './types';
import type { DualSyncSectionKey } from '@/server/dual-sync';

const SettingsSectionSkeleton = ({ title }: { title: string }) => (
  <Card className="border-border/60 bg-muted/30" aria-busy="true" role="status">
    <CardHeader className="p-4 pb-0">
      <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-3 p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </CardContent>
  </Card>
);

const AvailabilitySkeleton = () => (
  <div className="flex flex-col gap-6">
    <Card className="border-border/70 bg-card">
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </CardHeader>
      <CardContent className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </CardContent>
    </Card>
    <Card className="border-border/60">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
    <Card className="border-border/60">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  </div>
);

const RestaurantProfileSection = dynamic(
  () => import('./RestaurantProfileSection').then((m) => m.RestaurantProfileSection),
  {
    loading: () => <SettingsSectionSkeleton title="Loading profile" />,
  },
);

const RestaurantBusinessContextSection = dynamic(
  () =>
    import('./RestaurantBusinessContextSection').then((m) => m.RestaurantBusinessContextSection),
  {
    loading: () => <SettingsSectionSkeleton title="Loading discovery details" />,
  },
);

const GoogleBusinessProfileSection = dynamic(
  () =>
    import('./google-business-profile/GoogleBusinessProfileSection').then(
      (m) => m.GoogleBusinessProfileSection,
    ),
  {
    loading: () => <SettingsSectionSkeleton title="Loading Google Business Profile" />,
  },
);

const AvailabilityOccasionsCommandCenter = dynamic(
  () =>
    import('./AvailabilityOccasionsCommandCenter').then(
      (m) => m.AvailabilityOccasionsCommandCenter,
    ),
  {
    loading: () => <AvailabilitySkeleton />,
  },
);

const OpsMenuManagementClient = dynamic(
  () => import('../menu').then((m) => m.OpsMenuManagementClient),
  {
    loading: () => <SettingsSectionSkeleton title="Loading menu" />,
  },
);

const TableInventoryClient = dynamic(
  () => import('../tables/TableInventoryClient').then((m) => m.default),
  {
    loading: () => <SettingsSectionSkeleton title="Loading tables" />,
  },
);

const OpsTeamManagementClient = dynamic(
  () => import('../team').then((m) => m.OpsTeamManagementClient),
  {
    loading: () => <SettingsSectionSkeleton title="Loading team" />,
  },
);

const DualSyncShell = dynamic(
  () => import('./dual-sync/DualSyncShell').then((m) => m.DualSyncShell),
  {
    loading: () => <SettingsSectionSkeleton title="Loading sync state" />,
    ssr: false,
  },
);

const DUAL_SYNC_SECTIONS_BY_VIEW: Partial<
  Record<RestaurantSettingsView, ReadonlyArray<DualSyncSectionKey>>
> = {
  'google-business-profile': [
    'profile',
    'operatingHours',
    'servicePeriods',
    'businessContext.categories',
    'businessContext.serviceAreas',
    'businessContext.attributes',
    'businessContext.serviceItems',
    'foodMenus',
  ],
};

export type OpsRestaurantSettingsClientProps = {
  defaultRestaurantId?: string | null;
  view: RestaurantSettingsView;
  availabilityWorkspace?: AvailabilitySettingsWorkspace;
};

export function OpsRestaurantSettingsClient({
  defaultRestaurantId,
  view,
  availabilityWorkspace,
}: OpsRestaurantSettingsClientProps) {
  const {
    memberships,
    activeRestaurantId,
    restaurantId: selectedRestaurantId,
    setActiveRestaurantId,
  } = useRestaurantSettingsContext();
  const googleBusinessProfileConnectionQuery = useOpsGoogleBusinessProfileConnection(
    view === 'google-business-profile' ? selectedRestaurantId : null,
  );

  useEffect(() => {
    if (activeRestaurantId) {
      return;
    }
    if (defaultRestaurantId) {
      setActiveRestaurantId(defaultRestaurantId);
      return;
    }
    if (memberships[0]) {
      setActiveRestaurantId(memberships[0].restaurantId);
    }
  }, [activeRestaurantId, defaultRestaurantId, memberships, setActiveRestaurantId]);

  if (memberships.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-8">
        <OpsEmptyState
          title="No restaurant access"
          description="You need access to at least one restaurant to manage settings. Contact an owner or admin for access."
        />
      </section>
    );
  }

  const dualSyncSections = DUAL_SYNC_SECTIONS_BY_VIEW[view];
  const hasSyncWorkspace = Boolean(dualSyncSections && selectedRestaurantId);
  const hasMappedGoogleLocation = Boolean(
    googleBusinessProfileConnectionQuery.data?.status === 'linked' &&
    googleBusinessProfileConnectionQuery.data.externalAccountId &&
    googleBusinessProfileConnectionQuery.data.externalLocationId,
  );
  const shouldRenderSyncWorkspace =
    hasSyncWorkspace && (view !== 'google-business-profile' || hasMappedGoogleLocation);

  const renderByView: Record<
    RestaurantSettingsView,
    (context: { restaurantId: string | null }) => ReactNode
  > = {
    profile: ({ restaurantId }) => <RestaurantProfileSection restaurantId={restaurantId} />,
    discovery: ({ restaurantId }) => (
      <RestaurantBusinessContextSection restaurantId={restaurantId} embedded={false} />
    ),
    'google-business-profile': ({ restaurantId }) => (
      <GoogleBusinessProfileSection
        restaurantId={restaurantId}
        hasSyncWorkspace={shouldRenderSyncWorkspace}
      />
    ),
    availability: ({ restaurantId }) => (
      <AvailabilityOccasionsCommandCenter
        restaurantId={restaurantId}
        initialWorkspace={availabilityWorkspace}
      />
    ),
    menu: () => <OpsMenuManagementClient />,
    tables: () => <TableInventoryClient />,
    team: () => <OpsTeamManagementClient />,
  };

  return (
    <div className={SETTINGS_COMPACT_ROUTE_STACK_CLASS}>
      {renderByView[view]({ restaurantId: selectedRestaurantId })}
      {dualSyncSections && selectedRestaurantId && shouldRenderSyncWorkspace ? (
        <div id="gbp-sync-review" className="scroll-mt-24">
          {view === 'google-business-profile' ? (
            <Alert className="mb-3 border-border/70 bg-muted/30">
              <AlertDescription className="leading-6 text-muted-foreground">
                Compare Google vs saved Nabatable fields. Edits to values still happen on{' '}
                <Link
                  href={opsHref('/settings/restaurant/profile#profile-contact')}
                  className="font-medium text-foreground underline"
                >
                  Profile
                </Link>{' '}
                or{' '}
                <Link
                  href={opsHref(
                    `/settings/restaurant/availability${availabilityHash(
                      AVAILABILITY_ANCHORS.availabilitySchedule,
                    )}`,
                  )}
                  className="font-medium text-foreground underline"
                >
                  Availability
                </Link>
                .
              </AlertDescription>
            </Alert>
          ) : null}
          <DualSyncShell
            restaurantId={selectedRestaurantId}
            sections={dualSyncSections}
            singleOpenSections={view === 'google-business-profile'}
          />
        </div>
      ) : null}
    </div>
  );
}
