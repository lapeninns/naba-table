import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BookingErrorBoundary } from "@/components/features/booking-state-machine";
import { OpsPageHeader } from "@/components/features/ops-shell/patterns/OpsPageHeader";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import { WalkInWizardClient } from "./_components/WalkInWizardClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Booking · Nab a Table Ops",
  description: "Create a new reservation using the standard booking flow with ops controls.",
};

export default async function WalkInPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/walk-in] failed to resolve auth", error.message);
  }

  if (!user) {
    redirect(withRedirectedFrom("/app/auth/signin", "/app/new-bookings"));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <OpsPageHeader
        title="New booking"
        subtitle="Create a walk-in or reservation with full ops controls."
      />
      <BookingErrorBoundary>
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading booking wizard...</div>}>
          <WalkInWizardClient />
        </Suspense>
      </BookingErrorBoundary>
    </div>
  );
}
