'use client';

import { useMemo } from 'react';

import { OpsEmailTemplatesClient } from '@/components/features/email-templates/OpsEmailTemplatesClient';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsEmailTemplatesDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <OpsEmailTemplatesClient />
    </OpsDevProviders>
  );
}
