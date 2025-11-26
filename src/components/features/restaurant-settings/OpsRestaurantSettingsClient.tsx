'use client';

import { useEffect, type ReactNode } from 'react';

import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';

import { OccasionsSection } from './OccasionsSection';
import { OperatingHoursSection } from './OperatingHoursSection';
import { RestaurantProfileSection } from './RestaurantProfileSection';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from './routes';
import { ServicePeriodsSection } from './ServicePeriodsSection';
import { OpsTeamManagementClient } from '../team';

import type { RestaurantSettingsView } from './types';

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
