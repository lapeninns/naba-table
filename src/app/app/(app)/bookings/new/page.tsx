import { redirect } from "next/navigation";

import { BookingErrorBoundary } from "@/components/features/booking-state-machine";
import { BookingOfflineQueueProvider } from "@/contexts/booking-offline-queue";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import { OpsWalkInWizardClient } from "./_components/OpsWalkInWizardClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create walk-in booking · SajiloReserveX Ops",
  description: "Log a walk-in reservation with the same booking flow used by guests, scoped to your restaurant.",
};

export default async function OpsWalkInBookingPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/bookings/new] failed to resolve auth", error.message);
  }

  if (!user) {
    redirect(withRedirectedFrom("/login", "/bookings/new"));
  }

  return (
    <BookingErrorBoundary>
      <BookingOfflineQueueProvider>
        <OpsWalkInWizardClient />
      </BookingOfflineQueueProvider>
    </BookingErrorBoundary>
  );
}
