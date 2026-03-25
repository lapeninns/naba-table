'use client';

import { HydrationBoundary } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { GuestProfileClient } from '@/components/features/guest/profile/GuestProfileClient';
import { GuestServicesProvider } from '@/guest/services/di';
import { queryKeys } from '@/lib/query/keys';

import {
  DEV_GUEST_PORTAL_PROFILE,
  DEV_GUEST_PORTAL_SESSION,
  applyProfilePayload,
  createGuestPortalServices,
  type GuestPortalReadFixture,
  type GuestProfileMutationFixture,
} from '../../_mocks/services/devGuestPortal';

import type { GuestProfileMutationController } from '@/components/features/guest/profile/GuestProfileClient';
import type { GuestProfileViewModel } from '@/guest/routes/profile/view-model';
import type { ProfileUpdatePayload } from '@/lib/profile/schema';

export function GuestProfileDevHarness({
  fixture,
  mutationFixture,
  viewModel,
}: {
  fixture: GuestPortalReadFixture;
  mutationFixture: GuestProfileMutationFixture;
  viewModel: GuestProfileViewModel;
}) {
  const queryClient = useQueryClient();
  const profileRef = useRef(viewModel.profile ?? DEV_GUEST_PORTAL_PROFILE);

  const services = useMemo(
    () => createGuestPortalServices(fixture, profileRef.current),
    [fixture],
  );

  const profileMutationOverride = useMemo<GuestProfileMutationController>(
    () => ({
      isPending: false,
      mutate: (
        payload: ProfileUpdatePayload,
        options?: {
          onSuccess?: (result: { profile: typeof profileRef.current; idempotent?: boolean }) => void;
          onError?: (error: unknown) => void;
        },
      ) => {
        if (mutationFixture === 'error') {
          options?.onError?.(new Error('Dev guest profile mutation fixture failed.'));
          return;
        }

        const nextProfile = applyProfilePayload(profileRef.current, payload);
        profileRef.current = nextProfile;
        queryClient.setQueryData(queryKeys.profile.self(), nextProfile);
        options?.onSuccess?.({ profile: nextProfile, idempotent: false });
      },
    }),
    [mutationFixture, queryClient],
  );

  return (
    <GuestServicesProvider services={services} sessionStateOverride={DEV_GUEST_PORTAL_SESSION}>
      <HydrationBoundary state={viewModel.dehydratedState}>
        <GuestProfileClient
          viewModel={viewModel}
          profileMutationOverride={profileMutationOverride}
        />
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}
