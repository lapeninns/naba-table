'use client';

import { useMemo } from 'react';

import { FloorPlanClient } from '@/components/features/floor-plan/FloorPlanClient';
import { OpsUnsavedChangesProvider } from '@/contexts/ops-unsaved-changes';

import { createDevFloorPlanServices } from './devFloorPlanServices';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsFloorPlanDevHarness({
  scenario,
  failNextAssign,
}: {
  scenario: 'live' | 'empty' | 'error';
  failNextAssign: boolean;
}) {
  const factories = useMemo(
    () => createDevFloorPlanServices({ scenario, failNextAssign }),
    [failNextAssign, scenario],
  );
  return (
    <OpsDevProviders factories={factories}>
      <OpsUnsavedChangesProvider>
        <div className="flex h-svh flex-col bg-background">
          <FloorPlanClient initialDate={null} />
        </div>
      </OpsUnsavedChangesProvider>
    </OpsDevProviders>
  );
}
