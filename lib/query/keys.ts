import type { RestaurantFilters } from '@/lib/restaurants/types';

export const queryKeys = {
  bookings: {
    all: ['bookings'] as const,
    list: (params: Record<string, unknown> = {}) => ['bookings', 'list', params] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
    history: (id: string, params: Record<string, unknown> = {}) => ['bookings', 'history', id, params] as const,
  },
  opsBookings: {
    all: ['ops', 'bookings'] as const,
    list: (params: Record<string, unknown> = {}) => ['ops', 'bookings', 'list', params] as const,
    detail: (id: string) => ['ops', 'bookings', 'detail', id] as const,
  },
  opsCustomers: {
    list: (params: Record<string, unknown> = {}) => ['ops', 'customers', 'list', params] as const,
  },
  opsRestaurants: {
    all: ['ops', 'restaurants'] as const,
    list: (params: Record<string, unknown> = {}) => ['ops', 'restaurants', 'list', params] as const,
    detail: (id: string) => ['ops', 'restaurants', 'detail', id] as const,
  },
  ownerRestaurants: {
    hours: (restaurantId: string) => ['owner', 'restaurants', restaurantId, 'hours'] as const,
    servicePeriods: (restaurantId: string) => ['owner', 'restaurants', restaurantId, 'service-periods'] as const,
    details: (restaurantId: string) => ['owner', 'restaurants', restaurantId, 'details'] as const,
  },
  profile: {
    self: () => ['profile', 'self'] as const,
  },
  restaurants: {
    all: ['restaurants'] as const,
    list: (params: RestaurantFilters = {}) => ['restaurants', 'list', params] as const,
  },
  team: {
    memberships: () => ['team', 'memberships'] as const,
    invitations: (restaurantId: string, status: string = 'pending') =>
      ['team', 'invitations', restaurantId, status] as const,
  },
};

export type QueryKey =
  | ReturnType<(typeof queryKeys)['bookings']['list']>
  | ReturnType<(typeof queryKeys)['bookings']['detail']>
  | ReturnType<(typeof queryKeys)['bookings']['history']>
  | ReturnType<(typeof queryKeys)['opsBookings']['list']>
  | ReturnType<(typeof queryKeys)['opsBookings']['detail']>
  | ReturnType<(typeof queryKeys)['opsCustomers']['list']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['list']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['detail']>
  | ReturnType<(typeof queryKeys)['ownerRestaurants']['hours']>
  | ReturnType<(typeof queryKeys)['ownerRestaurants']['servicePeriods']>
  | ReturnType<(typeof queryKeys)['ownerRestaurants']['details']>
  | ReturnType<(typeof queryKeys)['profile']['self']>
  | ReturnType<(typeof queryKeys)['restaurants']['list']>
  | ReturnType<(typeof queryKeys)['team']['memberships']>
  | ReturnType<(typeof queryKeys)['team']['invitations']>;
