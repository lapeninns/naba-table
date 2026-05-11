'use client';

import { Suspense, useMemo } from 'react';

import { WalkInWizardClient } from '@/app/app/(app)/new-bookings/_components/WalkInWizardClient';
import { BookingErrorBoundary } from '@/components/features/booking-state-machine';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Card } from '@/components/ui/card';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsNewBookingDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
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
      </OpsPageShell>
    </OpsDevProviders>
  );
}
