import { HydrationBoundary } from "@tanstack/react-query";

import { GuestDashboardClient } from "@/components/features/guest/dashboard/GuestDashboardClient";
import { GuestServicesProvider } from "@/guest/services/di";

import type { GuestDashboardViewModel } from "./view-model";

export function GuestDashboardPageView({ viewModel }: { viewModel: GuestDashboardViewModel }) {
  return (
    <GuestServicesProvider>
      <HydrationBoundary state={viewModel.dehydratedState}>
        <GuestDashboardClient />
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}

