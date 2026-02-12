'use client';

import { useMemo } from 'react';

import { BookingErrorBoundary } from '@/components/features/booking-state-machine';
import { OpsBookingsClient } from '@/components/features/bookings/OpsBookingsClient';
import { BookingOfflineQueueProvider } from '@/contexts/booking-offline-queue';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsBookingsDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <BookingErrorBoundary>
        <BookingOfflineQueueProvider>
          <OpsBookingsClient initialRestaurantId={DEV_RESTAURANT_ID} />
        </BookingOfflineQueueProvider>
      </BookingErrorBoundary>
    </OpsDevProviders>
  );
}

