import { HydrationBoundary } from "@tanstack/react-query";

import { BookingListClient } from "@/components/features/booking/list/BookingListClient";
import { GuestServicesProvider } from "@/guest/services/di";

import type { GuestBookingsViewModel } from "./view-model";
import type { GuestServices } from "@/guest/services/ports";
import type { SupabaseSessionState } from "@/hooks/useSupabaseSession";

export function GuestBookingsPageView({
  viewModel,
  services,
  sessionStateOverride,
}: {
  viewModel: GuestBookingsViewModel;
  services?: Partial<GuestServices>;
  sessionStateOverride?: SupabaseSessionState;
}) {
  return (
    <GuestServicesProvider services={services} sessionStateOverride={sessionStateOverride}>
      <HydrationBoundary state={viewModel.dehydratedState}>
        <BookingListClient initialTab={viewModel.initialTab} />
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}
