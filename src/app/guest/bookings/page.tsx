import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";


import { BookingListClient } from "@/components/features/booking/list/BookingListClient";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Bookings · SajiloReserveX",
  description: "View upcoming and past bookings.",
};

export default async function MyBookingsPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin?redirectedFrom=/guest/bookings");
  }

  const queryClient = new QueryClient();

  // Prefetch logic would go here using a server-side API or direct DB call if implemented
  // For now, we rely on client-side fetching in BookingListClient

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <BookingListClient />
    </HydrationBoundary>
  );
}
