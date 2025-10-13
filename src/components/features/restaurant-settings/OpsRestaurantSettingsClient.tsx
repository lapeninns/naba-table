'use client';

import { useEffect, useMemo } from 'react';

import { useOpsSession } from '@/contexts/ops-session';

import { RestaurantSelector } from './RestaurantSelector';
import { RestaurantProfileSection } from './RestaurantProfileSection';
import { OperatingHoursSection } from './OperatingHoursSection';
import { ServicePeriodsSection } from './ServicePeriodsSection';
import type { RestaurantOption } from './types';

export type OpsRestaurantSettingsClientProps = {
  defaultRestaurantId?: string | null;
};

export function OpsRestaurantSettingsClient({ defaultRestaurantId }: OpsRestaurantSettingsClientProps) {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();

  const restaurantOptions = useMemo<RestaurantOption[]>(
    () =>
      memberships.map((membership) => ({
        id: membership.restaurantId,
        name: membership.restaurantName ?? 'Restaurant',
        role: membership.role,
      })),
    [memberships],
  );

  useEffect(() => {
    if (activeRestaurantId) {
      return;
    }
    if (defaultRestaurantId) {
      setActiveRestaurantId(defaultRestaurantId);
      return;
    }
    if (restaurantOptions[0]) {
      setActiveRestaurantId(restaurantOptions[0].id);
    }
  }, [activeRestaurantId, defaultRestaurantId, restaurantOptions, setActiveRestaurantId]);

  if (restaurantOptions.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant access</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You need access to at least one restaurant to manage settings. Contact an owner or admin for access.
        </p>
      </section>
    );
  }

  const selectedRestaurantId = activeRestaurantId ?? defaultRestaurantId ?? restaurantOptions[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Restaurant Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your restaurant profile, operating hours, and service periods.
        </p>
      </div>

      <RestaurantSelector
        restaurants={restaurantOptions}
        value={selectedRestaurantId}
        onChange={setActiveRestaurantId}
      />

      <RestaurantProfileSection restaurantId={selectedRestaurantId} />

      <OperatingHoursSection restaurantId={selectedRestaurantId} />

      <ServicePeriodsSection restaurantId={selectedRestaurantId} />
    </div>
  );
}
