import { QueryClient, dehydrate, type DehydratedState } from '@tanstack/react-query';

import { buildBookingsQueryKeyParams } from '@/guest/services/bookings-params';
import { queryKeys } from '@/lib/query/keys';

import type { GuestServerServices } from '@/guest/services/server';

export type GuestDashboardViewModel = {
  dehydratedState: DehydratedState;
};

export const buildGuestDashboardViewModel = async (
  services: GuestServerServices,
): Promise<GuestDashboardViewModel> => {
  const user = await services.auth.requireUser({
    redirectTo: '/auth/signin',
    redirectedFrom: '/guest/dashboard',
  });

  const queryClient = new QueryClient();
  const bookingsFilters = { page: 1, pageSize: 10 } as const;

  const [bookingsResult, profileResult] = await Promise.allSettled([
    services.bookings.list(bookingsFilters),
    services.profile.ensureForUser(user),
  ]);

  if (bookingsResult.status === 'fulfilled') {
    const bookings = bookingsResult.value;
    queryClient.setQueryData(
      queryKeys.bookings.list(buildBookingsQueryKeyParams(bookingsFilters)),
      bookings,
    );
  } else {
    console.warn('[guest/dashboard] prefetch bookings skipped', bookingsResult.reason);
  }

  if (profileResult.status === 'fulfilled') {
    const profile = profileResult.value;
    queryClient.setQueryData(queryKeys.profile.self(), profile);
  } else {
    console.warn('[guest/dashboard] prefetch profile skipped', profileResult.reason);
  }

  return {
    dehydratedState: dehydrate(queryClient),
  };
};
