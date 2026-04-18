'use client';

import { useMemo } from 'react';

import { OpsMenuManagementClient } from '@/components/features/menu';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsMenuDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <OpsMenuManagementClient />
    </OpsDevProviders>
  );
}
