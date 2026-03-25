import { HydrationBoundary } from "@tanstack/react-query";

import { GuestProfileClient } from "@/components/features/guest/profile/GuestProfileClient";
import { GuestServicesProvider } from "@/guest/services/di";

import type { GuestProfileViewModel } from "./view-model";
import type { GuestProfileMutationController } from "@/components/features/guest/profile/GuestProfileClient";
import type { GuestServices } from "@/guest/services/ports";
import type { SupabaseSessionState } from "@/hooks/useSupabaseSession";

export function GuestProfilePageView({
  viewModel,
  services,
  sessionStateOverride,
  profileMutationOverride,
}: {
  viewModel: GuestProfileViewModel;
  services?: Partial<GuestServices>;
  sessionStateOverride?: SupabaseSessionState;
  profileMutationOverride?: GuestProfileMutationController;
}) {
  return (
    <GuestServicesProvider services={services} sessionStateOverride={sessionStateOverride}>
      <HydrationBoundary state={viewModel.dehydratedState}>
        <GuestProfileClient viewModel={viewModel} profileMutationOverride={profileMutationOverride} />
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}
