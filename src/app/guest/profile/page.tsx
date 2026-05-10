
import { GuestProfilePageView } from "@/guest/routes/profile/page-view";
import { buildGuestProfileViewModel } from "@/guest/routes/profile/view-model";
import { createGuestServerServices } from "@/guest/services/server";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile · Nab a Table",
  description: "Manage your personal details and account settings.",
};

export default async function ProfilePage() {
  const services = await createGuestServerServices();
  const viewModel = await buildGuestProfileViewModel(services);
  return <GuestProfilePageView viewModel={viewModel} />;
}
