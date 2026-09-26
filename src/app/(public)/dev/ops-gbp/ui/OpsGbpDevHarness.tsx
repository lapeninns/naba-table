'use client';

import { useMemo, useState } from 'react';

import { GbpDriftProvider } from '@/components/features/restaurant-settings/GbpDriftProvider';
import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { RestaurantSettingsFocusedShell } from '@/components/features/restaurant-settings/RestaurantSettingsFocusedShell';
import { createBrowserRestaurantService } from '@/services/ops/restaurants';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { ensureGbpFetchMock } from '../../_mocks/gbp/gbpFetchMock';
import { GBP_SCENARIOS, type GbpScenario } from '../../_mocks/gbp/gbpFixtures';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { createDevRestaurantService } from '../../_mocks/services/devRestaurantService';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

/** The in-memory dev restaurant service, with the Google calls going through the real client. */
function createGbpHarnessRestaurantService() {
  const real = createBrowserRestaurantService();
  return Object.assign(createDevRestaurantService(), {
    getGoogleBusinessProfileConnection: real.getGoogleBusinessProfileConnection,
    getGoogleBusinessProfileAvailableLocations: real.getGoogleBusinessProfileAvailableLocations,
    startGoogleBusinessProfileAuthorization: real.startGoogleBusinessProfileAuthorization,
    linkGoogleBusinessProfileLocation: real.linkGoogleBusinessProfileLocation,
    disconnectGoogleBusinessProfileConnection: real.disconnectGoogleBusinessProfileConnection,
  });
}

/**
 * Google Business Profile settings with scenario fixtures (`?scenario=`). The page's real hooks
 * and clients run; `installGbpFetchMock` answers their requests.
 */
export function OpsGbpDevHarness({ scenario }: { scenario: GbpScenario }) {
  // Installed once per page load, before the first query runs. Changing the scenario reloads
  // the page, so the mock is never swapped while the page is running (Strict Mode's effect
  // replay would otherwise remove it).
  useState(() => {
    if (typeof window !== 'undefined') ensureGbpFetchMock(scenario);
  });

  const factories = useMemo(
    () => ({
      ...createOpsDevServiceFactories(),
      restaurantService: createGbpHarnessRestaurantService,
    }),
    [],
  );

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <GbpDriftProvider>
        <RestaurantSettingsFocusedShell title="Google Business Profile">
          <label className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Dev scenario
            <select
              className="rounded border bg-background px-2 py-1 text-foreground"
              value={scenario}
              onChange={(event) => {
                window.location.search = `?scenario=${event.target.value}`;
              }}
            >
              {Object.entries(GBP_SCENARIOS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <OpsRestaurantSettingsClient
            defaultRestaurantId={DEV_RESTAURANT_ID}
            view="google-business-profile"
          />
        </RestaurantSettingsFocusedShell>
      </GbpDriftProvider>
    </OpsDevProviders>
  );
}
