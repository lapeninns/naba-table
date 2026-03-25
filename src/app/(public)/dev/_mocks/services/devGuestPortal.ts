import { QueryClient, dehydrate } from '@tanstack/react-query';

import { GUEST_PORTAL_BOOKINGS_FILTERS, buildBookingsQueryKeyParams } from '@/guest/services/bookings-params';
import { queryKeys } from '@/lib/query/keys';

import type { BookingDTO, GuestServices } from '@/guest/services/ports';
import type { SupabaseSessionState } from '@/hooks/useSupabaseSession';
import type { ProfileResponse, ProfileUpdatePayload } from '@/lib/profile/schema';
import type { User } from '@supabase/supabase-js';

export type GuestPortalReadFixture = 'default' | 'empty' | 'error' | 'loading';
export type GuestProfileMutationFixture = 'success' | 'error';

export const DEV_GUEST_PORTAL_USER = {
  id: 'guest-dev-user',
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-03-01T09:00:00.000Z',
  email: 'ada@example.com',
  user_metadata: {
    full_name: 'Ada Lovelace',
  },
} as unknown as User;

export const DEV_GUEST_PORTAL_SESSION: SupabaseSessionState = {
  user: DEV_GUEST_PORTAL_USER,
  session: null,
  status: 'authenticated',
};

export const DEV_GUEST_PORTAL_PROFILE: ProfileResponse = {
  id: 'guest-profile-dev',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  phone: '+447700900123',
  image: null,
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-03-21T17:30:00.000Z',
};

export const DEV_GUEST_PORTAL_BOOKINGS: BookingDTO[] = [
  {
    id: 'guest-booking-upcoming',
    restaurantId: 'rest-fox',
    restaurantName: 'The Fox',
    restaurantSlug: 'the-fox',
    restaurantTimezone: 'Europe/London',
    partySize: 2,
    startIso: '2026-04-04T19:00:00.000Z',
    endIso: '2026-04-04T20:30:00.000Z',
    status: 'confirmed',
    notes: 'Window table if possible',
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    customerPhone: '+447700900123',
    reference: 'FOX-APR-1',
  },
  {
    id: 'guest-booking-pending',
    restaurantId: 'rest-elm',
    restaurantName: 'The Elm Room',
    restaurantSlug: 'the-elm-room',
    restaurantTimezone: 'Europe/London',
    partySize: 4,
    startIso: '2026-04-18T18:30:00.000Z',
    endIso: '2026-04-18T20:00:00.000Z',
    status: 'pending',
    notes: null,
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    customerPhone: '+447700900123',
    reference: 'ELM-APR-2',
  },
  {
    id: 'guest-booking-completed',
    restaurantId: 'rest-orchard',
    restaurantName: 'Orchard House',
    restaurantSlug: 'orchard-house',
    restaurantTimezone: 'Europe/London',
    partySize: 3,
    startIso: '2026-02-10T18:00:00.000Z',
    endIso: '2026-02-10T19:30:00.000Z',
    status: 'completed',
    notes: null,
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    customerPhone: '+447700900123',
    reference: 'ORCH-FEB-3',
  },
  {
    id: 'guest-booking-cancelled',
    restaurantId: 'rest-harbor',
    restaurantName: 'Harbor Table',
    restaurantSlug: 'harbor-table',
    restaurantTimezone: 'Europe/London',
    partySize: 2,
    startIso: '2026-01-22T20:00:00.000Z',
    endIso: '2026-01-22T21:30:00.000Z',
    status: 'cancelled',
    notes: 'Anniversary',
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    customerPhone: '+447700900123',
    reference: 'HARB-JAN-4',
  },
];

export function createGuestPortalServices(
  fixture: GuestPortalReadFixture,
  profile: ProfileResponse = DEV_GUEST_PORTAL_PROFILE,
  bookings: BookingDTO[] = DEV_GUEST_PORTAL_BOOKINGS,
): Partial<GuestServices> {
  const auth = {
    getUser: async () => DEV_GUEST_PORTAL_USER,
    requireUser: async () => DEV_GUEST_PORTAL_USER,
  } satisfies GuestServices['auth'];

  if (fixture === 'loading') {
    const pending = new Promise<never>(() => {});
    return {
      auth,
      bookings: {
        list: async () => pending,
      },
      profile: {
        getSelf: async () => pending,
        ensureForUser: async () => pending,
      },
    };
  }

  if (fixture === 'error') {
    return {
      auth,
      bookings: {
        list: async () => {
          throw new Error('Dev guest portal fixture failed to load bookings.');
        },
      },
      profile: {
        getSelf: async () => {
          throw new Error('Dev guest portal fixture failed to load profile.');
        },
        ensureForUser: async () => {
          throw new Error('Dev guest portal fixture failed to load profile.');
        },
      },
    };
  }

  const items = fixture === 'empty' ? [] : bookings;

  return {
    auth,
    bookings: {
      list: async () => ({
        items,
        pageInfo: {
          page: GUEST_PORTAL_BOOKINGS_FILTERS.page,
          pageSize: GUEST_PORTAL_BOOKINGS_FILTERS.pageSize,
          total: items.length,
          hasNext: false,
        },
      }),
    },
    profile: {
      getSelf: async () => profile,
      ensureForUser: async () => profile,
    },
  };
}

export function createGuestPortalDehydratedState(
  fixture: GuestPortalReadFixture,
  profile: ProfileResponse = DEV_GUEST_PORTAL_PROFILE,
  bookings: BookingDTO[] = DEV_GUEST_PORTAL_BOOKINGS,
) {
  const queryClient = new QueryClient();

  if (fixture === 'default' || fixture === 'empty') {
    const items = fixture === 'empty' ? [] : bookings;
    queryClient.setQueryData(queryKeys.profile.self(), profile);
    queryClient.setQueryData(
      queryKeys.bookings.list(buildBookingsQueryKeyParams(GUEST_PORTAL_BOOKINGS_FILTERS)),
      {
        items,
        pageInfo: {
          page: GUEST_PORTAL_BOOKINGS_FILTERS.page,
          pageSize: GUEST_PORTAL_BOOKINGS_FILTERS.pageSize,
          total: items.length,
          hasNext: false,
        },
      },
    );
  }

  return dehydrate(queryClient);
}

export function applyProfilePayload(
  profile: ProfileResponse,
  payload: ProfileUpdatePayload,
): ProfileResponse {
  return {
    ...profile,
    name: Object.prototype.hasOwnProperty.call(payload, 'name') ? payload.name ?? null : profile.name,
    phone: Object.prototype.hasOwnProperty.call(payload, 'phone') ? payload.phone ?? null : profile.phone,
    image: Object.prototype.hasOwnProperty.call(payload, 'image') ? payload.image ?? null : profile.image,
    updatedAt: new Date().toISOString(),
  };
}
