'use client';

import { useMemo } from 'react';

import { OpsCustomersClient } from '@/components/features/customers/OpsCustomersClient';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsCustomersDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <OpsCustomersClient defaultRestaurantId={DEV_RESTAURANT_ID} />
    </OpsDevProviders>
  );
}

