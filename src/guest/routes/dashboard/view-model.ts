import { QueryClient, dehydrate, type DehydratedState } from "@tanstack/react-query";

import {
  GUEST_PORTAL_BOOKINGS_FILTERS,
  buildBookingsQueryKeyParams,
} from "@/guest/services/bookings-params";
import { queryKeys } from "@/lib/query/keys";

import type { GuestServerServices } from "@/guest/services/server";

export type GuestDashboardViewModel = {
  dehydratedState: DehydratedState;
};

export const buildGuestDashboardViewModel = async (
  services: GuestServerServices,
): Promise<GuestDashboardViewModel> => {
  const user = await services.auth.requireUser({
    redirectTo: "/auth/signin",
    redirectedFrom: "/guest/dashboard",
  });

  const queryClient = new QueryClient();
  const bookingsFilters = GUEST_PORTAL_BOOKINGS_FILTERS;

  try {
    const bookings = await services.bookings.list(bookingsFilters);
    queryClient.setQueryData(queryKeys.bookings.list(buildBookingsQueryKeyParams(bookingsFilters)), bookings);
  } catch (error) {
    console.warn("[guest/dashboard] prefetch bookings skipped", error);
  }

  try {
    const profile = await services.profile.ensureForUser(user);
    queryClient.setQueryData(queryKeys.profile.self(), profile);
  } catch (error) {
    console.warn("[guest/dashboard] prefetch profile skipped", error);
  }

  return {
    dehydratedState: dehydrate(queryClient),
  };
};
