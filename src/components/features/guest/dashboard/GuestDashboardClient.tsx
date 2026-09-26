'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { GuestContent, GuestError, GuestPageFrame } from '@/components/guest/ui';
import { useGuestBookings, useGuestProfile, useGuestSession } from '@/guest/hooks';
import { StatusRegion } from '@/guest/routes/shared/StatusRegion';
import { queryKeys } from '@/lib/query/keys';

import { deriveGuestDashboardViewState } from './booking-derivations';
import { GuestDashboardCurrentReservationSection } from './GuestDashboardCurrentReservationSection';
import { GuestDashboardHeader } from './GuestDashboardHeader';
import { GuestDashboardQuickLinks } from './GuestDashboardQuickLinks';
import { GuestDashboardUpcomingSection } from './GuestDashboardUpcomingSection';

export function GuestDashboardClient() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGuestBookings();
  const { data: profile } = useGuestProfile();
  const { user } = useGuestSession();

  const dashboardState = useMemo(
    () =>
      deriveGuestDashboardViewState({
        bookings: data?.items ?? [],
        profile,
        user,
      }),
    [data?.items, profile, user],
  );
  const { firstName, primaryBooking, upcomingList } = dashboardState;

  if (isError) {
    return (
      <StatusRegion focus live="assertive">
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <GuestError
            description="We couldn't fetch your reservations. Please try again."
            onRetry={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list() });
              queryClient.invalidateQueries({ queryKey: queryKeys.profile.self() });
            }}
          />
        </div>
      </StatusRegion>
    );
  }

  return (
    <GuestPageFrame className="pb-12 sm:pb-16">
      <GuestContent className="flex flex-col gap-6 py-7 sm:gap-7 sm:py-9 lg:py-10">
        <GuestDashboardHeader firstName={firstName} />

        <GuestDashboardCurrentReservationSection booking={primaryBooking} isLoading={isLoading} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)] lg:items-start">
          <GuestDashboardUpcomingSection isLoading={isLoading} upcomingList={upcomingList} />
          <GuestDashboardQuickLinks />
        </div>
      </GuestContent>
    </GuestPageFrame>
  );
}
