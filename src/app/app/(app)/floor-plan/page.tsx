import { BookingErrorBoundary } from '@/components/features/booking-state-machine';
import { FloorPlanClient } from '@/components/features/floor-plan/FloorPlanClient';
import { BookingOfflineQueueProvider } from '@/contexts/booking-offline-queue';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Floor plan · Nab a Table',
  description: 'Live service-view floor plan — seat, clear, combine, and arrange your tables.',
};

export default function FloorPlanPage() {
  const initialNowIso = new Date().toISOString();

  return (
    <BookingErrorBoundary>
      <BookingOfflineQueueProvider>
        <FloorPlanClient initialNowIso={initialNowIso} />
      </BookingOfflineQueueProvider>
    </BookingErrorBoundary>
  );
}
