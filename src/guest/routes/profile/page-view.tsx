import { HydrationBoundary } from "@tanstack/react-query";

import { GuestProfileClient } from "@/components/features/guest/profile/GuestProfileClient";
import { GuestServicesProvider } from "@/guest/services/di";

import type { GuestProfileViewModel } from "./view-model";

export function GuestProfilePageView({ viewModel }: { viewModel: GuestProfileViewModel }) {
  return (
    <GuestServicesProvider>
      <HydrationBoundary state={viewModel.dehydratedState}>
        <GuestProfileClient viewModel={viewModel} />
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}

