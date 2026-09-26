'use client';

import { useMemo } from 'react';

import { OpsEmailTemplatesClient } from '@/components/features/email-templates/OpsEmailTemplatesClient';
import { GbpDriftProvider } from '@/components/features/restaurant-settings/GbpDriftProvider';
import { RestaurantSettingsFocusedShell } from '@/components/features/restaurant-settings/RestaurantSettingsFocusedShell';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

/** Mirrors `/app/settings/restaurant/email-templates`: the editor fills the settings workspace. */
export function OpsEmailTemplatesDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <GbpDriftProvider>
        <RestaurantSettingsFocusedShell title="Email templates" workspace>
          <OpsEmailTemplatesClient embedded />
        </RestaurantSettingsFocusedShell>
      </GbpDriftProvider>
    </OpsDevProviders>
  );
}
