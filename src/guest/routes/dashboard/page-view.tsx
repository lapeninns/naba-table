import { HydrationBoundary } from "@tanstack/react-query";

import { GuestDashboardClient } from "@/components/features/guest/dashboard/GuestDashboardClient";
import { GuestServicesProvider } from "@/guest/services/di";

import type { GuestDashboardViewModel } from "./view-model";
import type { GuestServices } from "@/guest/services/ports";
import type { SupabaseSessionState } from "@/hooks/useSupabaseSession";

export function GuestDashboardPageView({
  viewModel,
  services,
  sessionStateOverride,
}: {
  viewModel: GuestDashboardViewModel;
  services?: Partial<GuestServices>;
  sessionStateOverride?: SupabaseSessionState;
}) {
  return (
    <GuestServicesProvider services={services} sessionStateOverride={sessionStateOverride}>
      <HydrationBoundary state={viewModel.dehydratedState}>
        <GuestDashboardClient />
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}
