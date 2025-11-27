import { BookingErrorBoundary } from "@/components/features/booking-state-machine";
import { OpsDashboardClient } from "@/components/features/dashboard";
import { BookingOfflineQueueProvider } from "@/contexts/booking-offline-queue";
import { sanitizeDateParam } from "@/utils/ops/dashboard";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ops Dashboard · Nab a Table",
  description: "Monitor today's bookings and keep your front of house running smoothly.",
};

type OpsPageSearchParams = {
  date?: string;
};

export default async function OpsDashboardPage({ searchParams }: { searchParams?: Promise<OpsPageSearchParams> }) {
  const resolvedParams = (await searchParams) ?? {};
  // Auth is now handled by the layout - no need for duplicate check

  return (
    <BookingErrorBoundary>
      <BookingOfflineQueueProvider>
        <OpsDashboardClient initialDate={sanitizeDateParam(resolvedParams.date)} />
      </BookingOfflineQueueProvider>
    </BookingErrorBoundary>
  );
}
