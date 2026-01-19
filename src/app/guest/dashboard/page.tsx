
import { GuestDashboardPageView } from "@/guest/routes/dashboard/page-view";
import { buildGuestDashboardViewModel } from "@/guest/routes/dashboard/view-model";
import { createGuestServerServices } from "@/guest/services/server";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard · Nab a Table",
  description: "Your reservations, favorites, and dining inspiration in one place.",
};

export default async function GuestDashboardPage() {
  const services = await createGuestServerServices();
  const viewModel = await buildGuestDashboardViewModel(services);
  return <GuestDashboardPageView viewModel={viewModel} />;
}
