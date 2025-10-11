'use client';

import { useEffect, useState } from 'react';

import type { RestaurantOption } from './types';
import { RestaurantSelector } from './RestaurantSelector';
import { OperatingHoursSection } from './OperatingHoursSection';
import { ServicePeriodsSection } from './ServicePeriodsSection';

type RestaurantSettingsClientProps = {
  restaurants: RestaurantOption[];
  defaultRestaurantId: string | null;
};

export function RestaurantSettingsClient({ restaurants, defaultRestaurantId }: RestaurantSettingsClientProps) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(defaultRestaurantId);

  useEffect(() => {
    if (!selectedRestaurantId && restaurants.length > 0) {
      setSelectedRestaurantId(restaurants[0]?.id ?? null);
    }
  }, [restaurants, selectedRestaurantId]);

  if (restaurants.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant access</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You need access to at least one restaurant to manage settings. Contact an owner or admin for access.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Restaurant Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure operating hours and service periods for your restaurant
        </p>
      </div>

      <RestaurantSelector
        restaurants={restaurants}
        value={selectedRestaurantId}
        onChange={setSelectedRestaurantId}
      />

      <OperatingHoursSection restaurantId={selectedRestaurantId} />

      <ServicePeriodsSection restaurantId={selectedRestaurantId} />
    </div>
  );
}
