import { redirect } from "next/navigation";

import { OpsWalkInBookingClient } from "@/components/features";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create walk-in booking · SajiloReserveX",
  description: "Record a walk-in guest and keep your floor plan up to date.",
};

export default async function OpsWalkInBookingPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/walk-in] auth resolution failed", error.message);
  }

  if (!user) {
    redirect(withRedirectedFrom("/login", "/bookings/new"));
  }

  return <OpsWalkInBookingClient />;
}
