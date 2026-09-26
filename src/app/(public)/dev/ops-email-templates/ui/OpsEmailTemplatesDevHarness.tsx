'use client';

import { useMemo, type ReactNode } from 'react';

import { OpsEmailTemplatesClient } from '@/components/features/email-templates/OpsEmailTemplatesClient';
import { GbpDriftProvider } from '@/components/features/restaurant-settings/GbpDriftProvider';
import { RestaurantSettingsFocusedShell } from '@/components/features/restaurant-settings/RestaurantSettingsFocusedShell';
import { useRestaurantService } from '@/contexts/ops-services';
import { emailTemplatesTransportFromService } from '@/services/ops/email-templates';
import { EmailTemplatesTransportProvider } from '@src/hooks/ops/emailTemplatesTransport';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

/** Routes the test send through the dev RestaurantService instead of the ops API. */
function DevEmailTemplatesTransport({ children }: { children: ReactNode }) {
  const restaurantService = useRestaurantService();
  const transport = useMemo(
    () => emailTemplatesTransportFromService(restaurantService),
    [restaurantService],
  );
  return (
    <EmailTemplatesTransportProvider transport={transport}>
      {children}
    </EmailTemplatesTransportProvider>
  );
}

/** Mirrors `/app/settings/restaurant/email-templates`: the editor fills the settings workspace. */
export function OpsEmailTemplatesDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <DevEmailTemplatesTransport>
        <GbpDriftProvider>
          <RestaurantSettingsFocusedShell title="Email templates" workspace>
            <OpsEmailTemplatesClient />
          </RestaurantSettingsFocusedShell>
        </GbpDriftProvider>
      </DevEmailTemplatesTransport>
    </OpsDevProviders>
  );
}
