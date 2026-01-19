
import { GuestBookingsPageView } from "@/guest/routes/bookings/page-view";
import { buildGuestBookingsViewModel } from "@/guest/routes/bookings/view-model";
import { createGuestServerServices } from "@/guest/services/server";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Bookings · Nab a Table",
  description: "View upcoming and past bookings.",
};

type SearchParams = Promise<{ tab?: string }>;

export default async function MyBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedParams = await searchParams;
  const services = await createGuestServerServices();
  const viewModel = await buildGuestBookingsViewModel(services, { tab: resolvedParams?.tab ?? null });
  return <GuestBookingsPageView viewModel={viewModel} />;
}
