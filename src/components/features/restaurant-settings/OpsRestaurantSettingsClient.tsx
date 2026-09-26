'use client';

import dynamic from 'next/dynamic';
import { useEffect, type ReactNode } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { RESTAURANT_SETTINGS_ROUTE_MAP } from './routes';
import { SETTINGS_COMPACT_ROUTE_STACK_CLASS } from './shared';
import { useRestaurantSettingsContext } from './shell/useRestaurantSettingsContext';

import type { RestaurantSettingsView } from './types';

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

const AvailabilitySettingsPage = dynamic(
  () => import('./availability/AvailabilitySettingsPage').then((m) => m.AvailabilitySettingsPage),
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

const StaffCommunicationsSection = dynamic(
  () =>
    import('./staff-communications/StaffCommunicationsSection').then(
      (m) => m.StaffCommunicationsSection,
    ),
  {
    loading: () => <SettingsSectionSkeleton title="Loading staff communications" />,
  },
);

const FloorLayoutWorkspace = dynamic(
  () => import('../floor-plan/FloorPlanClient').then((m) => m.FloorLayoutClient),
  {
    loading: () => <SettingsSectionSkeleton title="Loading floor layout" />,
  },
);

const OpsEmailTemplatesClient = dynamic(
  () => import('../email-templates/OpsEmailTemplatesClient').then((m) => m.OpsEmailTemplatesClient),
  {
    loading: () => <SettingsSectionSkeleton title="Loading email templates" />,
  },
);

export type OpsRestaurantSettingsClientProps = {
  defaultRestaurantId?: string | null;
  view: RestaurantSettingsView;
};

export function OpsRestaurantSettingsClient({
  defaultRestaurantId,
  view,
}: OpsRestaurantSettingsClientProps) {
  const {
    memberships,
    activeRestaurantId,
    restaurantId: selectedRestaurantId,
    setActiveRestaurantId,
  } = useRestaurantSettingsContext();

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

  const renderByView: Record<
    RestaurantSettingsView,
    (context: { restaurantId: string | null }) => ReactNode
  > = {
    profile: ({ restaurantId }) => <RestaurantProfileSection restaurantId={restaurantId} />,
    discovery: ({ restaurantId }) => (
      <RestaurantBusinessContextSection restaurantId={restaurantId} />
    ),
    'google-business-profile': ({ restaurantId }) => (
      <GoogleBusinessProfileSection restaurantId={restaurantId} />
    ),
    availability: ({ restaurantId }) => <AvailabilitySettingsPage restaurantId={restaurantId} />,
    menu: () => <OpsMenuManagementClient />,
    tables: () => <TableInventoryClient />,
    team: () => <OpsTeamManagementClient />,
    'staff-communications': ({ restaurantId }) => (
      <StaffCommunicationsSection restaurantId={restaurantId} />
    ),
    'table-layout': () => <FloorLayoutWorkspace />,
    'email-templates': () => <OpsEmailTemplatesClient />,
  };

  const workspace = RESTAURANT_SETTINGS_ROUTE_MAP[view].layout === 'workspace';

  return (
    <div className={cn(SETTINGS_COMPACT_ROUTE_STACK_CLASS, workspace && 'min-h-0 flex-1')}>
      {renderByView[view]({ restaurantId: selectedRestaurantId })}
    </div>
  );
}
