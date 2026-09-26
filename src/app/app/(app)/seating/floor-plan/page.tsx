import { BookingErrorBoundary } from '@/components/features/booking-state-machine';
import { FloorPlanClient } from '@/components/features/floor-plan/FloorPlanClient';
import { BookingOfflineQueueProvider } from '@/contexts/booking-offline-queue';
import { sanitizeDateParam } from '@/utils/ops/dashboard';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Floor plan · Nab a Table',
  description: 'See every table live, seat arrivals and assign bookings on the floor plan.',
};

type FloorPlanSearchParams = {
  date?: string;
};

export default async function SeatingFloorPlanPage({
  searchParams,
}: {
  searchParams?: Promise<FloorPlanSearchParams>;
}) {
  const resolvedParams = (await searchParams) ?? {};
  const initialDate = sanitizeDateParam(resolvedParams.date);

  return (
    <BookingErrorBoundary>
      <BookingOfflineQueueProvider>
        <FloorPlanClient initialDate={initialDate} />
      </BookingOfflineQueueProvider>
    </BookingErrorBoundary>
  );
}
