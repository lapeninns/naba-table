import { redirect } from "next/navigation";

import { BookingErrorBoundary } from "@/components/features/booking-state-machine";
import { OpsDashboardClient } from "@/components/features/dashboard";
import { BookingOfflineQueueProvider } from "@/contexts/booking-offline-queue";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { getServerComponentSupabaseClient } from "@/server/supabase";
import { sanitizeDateParam } from "@/utils/ops/dashboard";

import type { Metadata } from "next";

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
    console.error("[app] failed to resolve auth", error.message);
  }

  if (!user) {
    redirect(withRedirectedFrom("/app/login", "/app/walk-in"));
  }

  return (
    <BookingErrorBoundary>
      <BookingOfflineQueueProvider>
        <OpsDashboardClient initialDate={sanitizeDateParam(resolvedParams.date)} />
      </BookingOfflineQueueProvider>
    </BookingErrorBoundary>
  );
}
