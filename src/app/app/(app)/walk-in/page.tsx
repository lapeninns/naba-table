import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BookingErrorBoundary } from "@/components/features/booking-state-machine";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import { WalkInWizardClient } from "./_components/WalkInWizardClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log a walk-in · SajiloReserveX Ops",
  description: "Create a walk-in reservation using the standard booking flow with ops controls.",
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
    redirect(withRedirectedFrom("/app/login", "/app/walk-in"));
  }

  return (
    <div className="flex flex-col gap-6 px-3 py-6 sm:px-4 lg:px-6">
      <BookingErrorBoundary>
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading walk-in wizard...</div>}>
          <WalkInWizardClient />
        </Suspense>
      </BookingErrorBoundary>
    </div>
  );
}
