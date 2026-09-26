'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';

import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { OpsUnsavedChangesProvider } from '@/contexts/ops-unsaved-changes';

import { DEV_MEMBERSHIPS, DEV_RESTAURANT_ID, DEV_USER } from '../_mocks/devSession';

import type { OpsMembership, OpsUser } from '@/types/ops';

type OpsDevProvidersProps = {
  children: ReactNode;
  factories?: Parameters<typeof OpsServicesProvider>[0]['factories'];
  user?: OpsUser | null;
  memberships?: OpsMembership[];
  initialRestaurantId?: string | null;
};

export function OpsDevProviders({
  children,
  factories,
  user = DEV_USER,
  memberships = DEV_MEMBERSHIPS,
  initialRestaurantId = DEV_RESTAURANT_ID,
}: OpsDevProvidersProps) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider factories={factories}>
        <OpsSessionProvider
          user={user}
          memberships={memberships}
          initialRestaurantId={initialRestaurantId}
        >
          {/* Mirrors OpsShell: settings chrome, nav and editors require the unsaved-changes registry. */}
          <OpsUnsavedChangesProvider>{children}</OpsUnsavedChangesProvider>
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>
  );
}
