'use client';

import { useEffect } from 'react';

import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';

import { OperatingHoursSection } from './OperatingHoursSection';
import { RestaurantProfileSection } from './RestaurantProfileSection';
import { ServicePeriodsSection } from './ServicePeriodsSection';

export type OpsRestaurantSettingsClientProps = {
  defaultRestaurantId?: string | null;
};

export function OpsRestaurantSettingsClient({ defaultRestaurantId }: OpsRestaurantSettingsClientProps) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Restaurant Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your restaurant profile, operating hours, and service periods.
        </p>
        <p className="text-xs text-muted-foreground">
          Currently editing settings for <span className="font-medium text-foreground">{restaurantName}</span>. Use the
          sidebar switcher to change restaurants.
        </p>
      </div>

      <RestaurantProfileSection restaurantId={selectedRestaurantId} />

      <OperatingHoursSection restaurantId={selectedRestaurantId} />

      <ServicePeriodsSection restaurantId={selectedRestaurantId} />
    </div>
  );
}
