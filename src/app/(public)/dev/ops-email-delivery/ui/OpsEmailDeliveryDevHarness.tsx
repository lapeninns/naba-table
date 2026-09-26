'use client';

import { useMemo, type ReactNode } from 'react';

import { OpsEmailDeliveryClient } from '@/components/features/email-delivery/OpsEmailDeliveryClient';
import { useBookingService } from '@/contexts/ops-services';
import { emailDeliveryTransportFromService } from '@/services/ops/email-delivery';
import { EmailDeliveryTransportProvider } from '@src/hooks/ops/emailDeliveryTransport';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

/** Routes resend and queue actions through the dev BookingService instead of the ops API. */
function DevEmailDeliveryTransport({ children }: { children: ReactNode }) {
  const bookingService = useBookingService();
  const transport = useMemo(
    () => emailDeliveryTransportFromService(bookingService),
    [bookingService],
  );
  return (
    <EmailDeliveryTransportProvider transport={transport}>{children}</EmailDeliveryTransportProvider>
  );
}

export function OpsEmailDeliveryDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <DevEmailDeliveryTransport>
        <OpsEmailDeliveryClient
          initialRestaurantId={DEV_RESTAURANT_ID}
          initialRange="7d"
          initialPage={1}
          initialPageSize={50}
          initialTab="delivery-log"
        />
      </DevEmailDeliveryTransport>
    </OpsDevProviders>
  );
}
