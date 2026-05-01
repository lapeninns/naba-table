'use client';

import dynamic from 'next/dynamic';
import { useEffect, type ReactNode } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { isDualSyncUiEnabled } from '@/lib/feature-flags/dual-sync';

import type { RestaurantSettingsView } from './types';
import type { DualSyncSectionKey } from '@/server/dual-sync';

const SettingsSectionSkeleton = ({ title }: { title: string }) => (
  <div
    className="rounded-lg border border-border/60 bg-muted/30 p-6"
    aria-busy="true"
    role="status"
  >
    <p className="text-sm font-medium text-foreground">{title}</p>
    <div className="mt-3 space-y-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  </div>
);

const RestaurantProfileSection = dynamic(
  () => import('./RestaurantProfileSection').then((m) => m.RestaurantProfileSection),
  {
    loading: () => <SettingsSectionSkeleton title="Loading profile" />,
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
    loading: () => <SettingsSectionSkeleton title="Loading availability and occasions" />,
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

const DualSyncShell = dynamic(() => import('./dual-sync').then((m) => m.DualSyncShell), {
  loading: () => <SettingsSectionSkeleton title="Loading sync state" />,
  ssr: false,
});

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
  ],
};

export type OpsRestaurantSettingsClientProps = {
  defaultRestaurantId?: string | null;
  view: RestaurantSettingsView;
};

export function OpsRestaurantSettingsClient({
  defaultRestaurantId,
  view,
}: OpsRestaurantSettingsClientProps) {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();

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

  const selectedMembership =
    activeMembership ??
    memberships.find((membership) => membership.restaurantId === activeRestaurantId) ??
    memberships[0] ??
    null;

  const selectedRestaurantId = selectedMembership?.restaurantId ?? null;

  const renderByView: Record<
    RestaurantSettingsView,
    (context: { restaurantId: string | null }) => ReactNode
  > = {
    profile: ({ restaurantId }) => <RestaurantProfileSection restaurantId={restaurantId} />,
    'google-business-profile': ({ restaurantId }) => (
      <GoogleBusinessProfileSection restaurantId={restaurantId} />
    ),
    availability: ({ restaurantId }) => (
      <AvailabilityOccasionsCommandCenter restaurantId={restaurantId} />
    ),
    menu: () => <OpsMenuManagementClient />,
    tables: () => <TableInventoryClient />,
    team: () => <OpsTeamManagementClient />,
  };

  const dualSyncSections = DUAL_SYNC_SECTIONS_BY_VIEW[view];
  const dualSyncEnabled = isDualSyncUiEnabled();

  return (
    <div className="space-y-6">
      {renderByView[view]({ restaurantId: selectedRestaurantId })}
      {dualSyncEnabled && dualSyncSections && selectedRestaurantId ? (
        <DualSyncShell restaurantId={selectedRestaurantId} sections={dualSyncSections} />
      ) : null}
    </div>
  );
}
