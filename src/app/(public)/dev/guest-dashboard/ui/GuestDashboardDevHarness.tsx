'use client';

import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { useMemo } from 'react';

import { GuestDashboardClient } from '@/components/features/guest/dashboard/GuestDashboardClient';
import { GuestServicesProvider } from '@/guest/services/di';

import {
  DEV_GUEST_PORTAL_SESSION,
  createGuestPortalServices,
  type GuestPortalReadFixture,
} from '../../_mocks/services/devGuestPortal';

export function GuestDashboardDevHarness({
  fixture,
  dehydratedState,
}: {
  fixture: GuestPortalReadFixture;
  dehydratedState: DehydratedState;
}) {
  const services = useMemo(() => createGuestPortalServices(fixture), [fixture]);

  return (
    <GuestServicesProvider services={services} sessionStateOverride={DEV_GUEST_PORTAL_SESSION}>
      <HydrationBoundary state={dehydratedState}>
        <GuestDashboardClient />
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}
