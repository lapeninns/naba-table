'use client';

import { useMemo } from 'react';

import FloorPlanPage from '@/components/features/seating/FloorPlanPage';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsFloorPlanDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <FloorPlanPage />
    </OpsDevProviders>
  );
}

