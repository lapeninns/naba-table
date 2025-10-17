import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OpsDashboardClient } from "@/components/features/dashboard";
import { BookingErrorBoundary } from "@/components/features/booking-state-machine";
import { BookingOfflineQueueProvider } from "@/contexts/booking-offline-queue";
import { getServerComponentSupabaseClient } from "@/server/supabase";
import { sanitizeDateParam } from "@/utils/ops/dashboard";

export const metadata: Metadata = {
  title: "Ops Dashboard · SajiloReserveX",
  description: "Monitor today’s bookings and keep your front of house running smoothly.",
};

type OpsPageSearchParams = {
  date?: string;
};

export default async function OpsDashboardPage({ searchParams }: { searchParams?: Promise<OpsPageSearchParams> }) {
  const resolvedParams = (await searchParams) ?? {};
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops] failed to resolve auth", error.message);
  }

  if (!user) {
    redirect(`/signin?redirectedFrom=/ops`);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 py-6">
      <BookingErrorBoundary>
        <BookingOfflineQueueProvider>
          <OpsDashboardClient initialDate={sanitizeDateParam(resolvedParams.date)} />
        </BookingOfflineQueueProvider>
      </BookingErrorBoundary>
    </div>
  );
}
