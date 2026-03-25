'use client';

import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BookingListClient } from '@/components/features/booking/list/BookingListClient';
import { GuestServicesProvider } from '@/guest/services/di';

import {
  DEV_GUEST_PORTAL_SESSION,
  createGuestPortalServices,
  type GuestPortalReadFixture,
} from '../../_mocks/services/devGuestPortal';

import type { BookingsTab } from '@/guest/lib/validation';


export function GuestBookingsDevHarness({
  fixture,
  dehydratedState,
  initialTab,
}: {
  fixture: GuestPortalReadFixture;
  dehydratedState: DehydratedState;
  initialTab: BookingsTab;
}) {
  const services = useMemo(() => createGuestPortalServices(fixture), [fixture]);

  return (
    <GuestServicesProvider services={services} sessionStateOverride={DEV_GUEST_PORTAL_SESSION}>
      <HydrationBoundary state={dehydratedState}>
        <BookingListClient initialTab={initialTab} />
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}
