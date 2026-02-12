'use client';

import dynamic from 'next/dynamic';
import { useEffect, type ReactNode } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';

import { RESTAURANT_SETTINGS_ROUTE_MAP } from './routes';

import type { RestaurantSettingsView } from './types';

const SettingsSectionSkeleton = ({ title }: { title: string }) => (
  <div className="rounded-lg border border-border/60 bg-muted/30 p-6" aria-busy="true" role="status">
    <p className="text-sm font-medium text-foreground">{title}</p>
    <div className="mt-3 space-y-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  </div>
);

const RestaurantProfileSection = dynamic(() => import('./RestaurantProfileSection').then((m) => m.RestaurantProfileSection), {
  loading: () => <SettingsSectionSkeleton title="Loading profile" />,
});

const OperatingHoursSection = dynamic(() => import('./OperatingHoursSection').then((m) => m.OperatingHoursSection), {
  loading: () => <SettingsSectionSkeleton title="Loading operating hours" />,
});

const OccasionsSection = dynamic(() => import('./OccasionsSection').then((m) => m.OccasionsSection), {
  loading: () => <SettingsSectionSkeleton title="Loading occasions" />,
});

const ServicePeriodsSection = dynamic(() => import('./ServicePeriodsSection').then((m) => m.ServicePeriodsSection), {
  loading: () => <SettingsSectionSkeleton title="Loading service periods" />,
});

const TurnDurationsSection = dynamic(() => import('./TurnDurationsSection').then((m) => m.TurnDurationsSection), {
  loading: () => <SettingsSectionSkeleton title="Loading reservation durations" />,
});

const OpsTeamManagementClient = dynamic(() => import('../team').then((m) => m.OpsTeamManagementClient), {
  loading: () => <SettingsSectionSkeleton title="Loading team" />,
});

export type OpsRestaurantSettingsClientProps = {
  defaultRestaurantId?: string | null;
  view: RestaurantSettingsView;
};

export function OpsRestaurantSettingsClient({ defaultRestaurantId, view }: OpsRestaurantSettingsClientProps) {
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

  const restaurantName = selectedMembership?.restaurantName ?? 'Selected restaurant';

  const viewConfig = RESTAURANT_SETTINGS_ROUTE_MAP[view];
  const renderByView: Record<RestaurantSettingsView, (context: { restaurantId: string | null; restaurantName: string }) => ReactNode> = {
    profile: ({ restaurantId }) => <RestaurantProfileSection restaurantId={restaurantId} />,
    'operating-hours': ({ restaurantId }) => <OperatingHoursSection restaurantId={restaurantId} />,
    occasions: () => <OccasionsSection />,
    'service-periods': ({ restaurantId }) => <ServicePeriodsSection restaurantId={restaurantId} />,
    'turn-durations': ({ restaurantId }) => <TurnDurationsSection restaurantId={restaurantId} />,
    team: () => <OpsTeamManagementClient />,
  };

  return (
    <div className="space-y-6">
      <OpsPageHeader
        title={viewConfig.title}
        subtitle={viewConfig.description}
        meta={
          <span className="text-xs text-muted-foreground">
            Currently editing settings for{' '}
            <span className="font-medium text-foreground">{restaurantName}</span>. Use the sidebar switcher to change
            restaurants.
          </span>
        }
        headingLevel="h2"
        titleClassName="text-2xl"
      />

      {renderByView[view]({ restaurantId: selectedRestaurantId, restaurantName })}
    </div>
  );
}
