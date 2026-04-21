'use client';

import { useMemo } from 'react';

import { OpsSmsDeliveryClient } from '@/components/features/sms-delivery/OpsSmsDeliveryClient';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsSmsDeliveryDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <OpsSmsDeliveryClient
        initialRestaurantId={DEV_RESTAURANT_ID}
        initialRange="7d"
        initialPage={1}
        initialPageSize={50}
      />
    </OpsDevProviders>
  );
}
