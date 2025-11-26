'use client';

import dynamic from 'next/dynamic';
import { useEffect, type ReactNode } from 'react';

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
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant access</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You need access to at least one restaurant to manage settings. Contact an owner or admin for access.
        </p>
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
    team: () => <OpsTeamManagementClient />,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Restaurant Settings</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{viewConfig.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{viewConfig.description}</p>
        <p className="text-xs text-muted-foreground">
          Currently editing settings for <span className="font-medium text-foreground">{restaurantName}</span>. Use the
          sidebar switcher to change restaurants.
        </p>
      </div>

      {renderByView[view]({ restaurantId: selectedRestaurantId, restaurantName })}
    </div>
  );
}
