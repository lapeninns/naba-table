import { Suspense } from 'react';

import { BookingErrorBoundary } from '@/components/features/booking-state-machine';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';

import { OpsGuestBookingWizard } from './_components/OpsGuestBookingWizard';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Booking · Nab a Table Ops',
  description: 'Create a new reservation using the standard booking flow with ops controls.',
};

export default async function WalkInPage() {
  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsPageHeader
        title="New booking"
        subtitle="Create a walk-in or reservation with full ops controls."
      />
      <BookingErrorBoundary>
        <Suspense
          fallback={
            <div className="p-8 text-center text-muted-foreground">Loading booking wizard...</div>
          }
        >
          <OpsGuestBookingWizard />
        </Suspense>
      </BookingErrorBoundary>
    </OpsPageShell>
  );
}
