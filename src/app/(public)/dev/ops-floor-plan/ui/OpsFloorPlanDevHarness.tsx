'use client';

import { useMemo } from 'react';

import {
  FloorLayoutClient,
  FloorPlanClient,
} from '@/components/features/floor-plan/FloorPlanClient';
import { GbpDriftProvider } from '@/components/features/restaurant-settings/GbpDriftProvider';
import { RestaurantSettingsFocusedShell } from '@/components/features/restaurant-settings/RestaurantSettingsFocusedShell';
import { OpsUnsavedChangesProvider } from '@/contexts/ops-unsaved-changes';

import { createDevFloorPlanServices } from './devFloorPlanServices';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsFloorPlanDevHarness({
  scenario,
  failNextAssign,
  surface,
}: {
  scenario: 'live' | 'empty' | 'error';
  failNextAssign: boolean;
  /** `layout` mirrors the Floor layout settings workspace. */
  surface: 'service' | 'layout';
}) {
  const factories = useMemo(
    () => createDevFloorPlanServices({ scenario, failNextAssign }),
    [failNextAssign, scenario],
  );
  return (
    <OpsDevProviders factories={factories}>
      <OpsUnsavedChangesProvider>
        {surface === 'layout' ? (
          <GbpDriftProvider>
            <RestaurantSettingsFocusedShell title="Floor layout" workspace>
              <FloorLayoutClient />
            </RestaurantSettingsFocusedShell>
          </GbpDriftProvider>
        ) : (
          <div className="flex h-svh flex-col bg-background">
            <FloorPlanClient initialDate={null} />
          </div>
        )}
      </OpsUnsavedChangesProvider>
    </OpsDevProviders>
  );
}
