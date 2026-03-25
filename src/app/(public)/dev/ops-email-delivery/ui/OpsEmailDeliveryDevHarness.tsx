'use client';

import { useMemo } from 'react';

import { OpsEmailDeliveryClient } from '@/components/features/email-delivery/OpsEmailDeliveryClient';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsEmailDeliveryDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <OpsEmailDeliveryClient
        initialRestaurantId={DEV_RESTAURANT_ID}
        initialRange="7d"
        initialPage={1}
        initialPageSize={50}
        initialTab="delivery-log"
      />
    </OpsDevProviders>
  );
}

