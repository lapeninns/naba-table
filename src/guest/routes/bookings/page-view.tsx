import { HydrationBoundary } from "@tanstack/react-query";

import { BookingListClient } from "@/components/features/booking/list/BookingListClient";
import { GuestServicesProvider } from "@/guest/services/di";

import type { GuestBookingsViewModel } from "./view-model";

export function GuestBookingsPageView({ viewModel }: { viewModel: GuestBookingsViewModel }) {
  return (
    <GuestServicesProvider>
      <HydrationBoundary state={viewModel.dehydratedState}>
        <BookingListClient initialTab={viewModel.initialTab} />
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}

