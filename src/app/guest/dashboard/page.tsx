import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import { GuestDashboardClient } from "@/components/features/guest/dashboard/GuestDashboardClient";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard · Nab a Table",
  description: "Your reservations, favorites, and dining inspiration in one place.",
};

export default async function GuestDashboardPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin?redirectedFrom=/guest/dashboard");
  }

  const queryClient = new QueryClient();
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <GuestDashboardClient />
    </HydrationBoundary>
  );
}
