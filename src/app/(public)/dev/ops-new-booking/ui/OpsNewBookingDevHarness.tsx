'use client';

import { Suspense, useMemo } from 'react';

import { WalkInWizardClient } from '@/app/app/(app)/new-bookings/_components/WalkInWizardClient';
import { BookingErrorBoundary } from '@/components/features/booking-state-machine';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { Card } from '@/components/ui/card';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsNewBookingDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <OpsPageHeader
          title="New booking (dev)"
          subtitle="Responsive QA harness for the walk-in wizard shell and container."
        />
        <BookingErrorBoundary>
          <Suspense
            fallback={
              <Card className="p-8 text-center text-sm text-muted-foreground">
                Loading booking wizard…
              </Card>
            }
          >
            <WalkInWizardClient />
          </Suspense>
        </BookingErrorBoundary>
      </div>
    </OpsDevProviders>
  );
}

