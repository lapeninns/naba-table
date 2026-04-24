'use client';

import { GuestProfileClient } from '@/components/features/guest/profile/GuestProfileClient';
import { GuestServicesProvider } from '@/guest/services/di';

import type { GuestProfileViewModel } from '@/guest/routes/profile/view-model';
import type { GuestServices } from '@/guest/services/ports';
import type { ProfileResponse } from '@/lib/profile/schema';

const devProfile: ProfileResponse = {
  id: 'guest-profile-dev',
  email: 'aman@example.com',
  name: 'Aman Shrestha',
  phone: '020 7946 0958',
  image: null,
  createdAt: '2026-04-24T10:24:44.000Z',
  updatedAt: '2026-04-24T10:24:44.000Z',
};

const viewModel: GuestProfileViewModel = {
  dehydratedState: {
    mutations: [],
    queries: [],
  },
  profile: devProfile,
};

const services: GuestServices = {
  auth: {
    getUser: async () => null,
    requireUser: async () => {
      throw new Error('Guest auth is not available in the dev harness.');
    },
  },
  bookings: {
    list: async () => ({
      items: [],
      pageInfo: {
        page: 1,
        pageSize: 10,
        total: 0,
        hasNext: false,
      },
    }),
  },
  profile: {
    getSelf: async () => devProfile,
    ensureForUser: async () => devProfile,
  },
};

export function GuestProfileDevHarness() {
  return (
    <GuestServicesProvider services={services}>
      <GuestProfileClient viewModel={viewModel} persistChanges={false} />
    </GuestServicesProvider>
  );
}
