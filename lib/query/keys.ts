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
  opsDashboard: {
    summary: (restaurantId: string, date?: string | null) =>
      ['ops', 'dashboard', restaurantId, 'summary', date ?? 'today'] as const,
    heatmap: (restaurantId: string, start: string, end: string) =>
      ['ops', 'dashboard', restaurantId, 'heatmap', start, end] as const,
  },
  opsCustomers: {
    list: (params: Record<string, unknown> = {}) => ['ops', 'customers', 'list', params] as const,
  },
  opsRestaurants: {
    all: ['ops', 'restaurants'] as const,
    list: (params: Record<string, unknown> = {}) => ['ops', 'restaurants', 'list', params] as const,
    detail: (id: string) => ['ops', 'restaurants', 'detail', id] as const,
    hours: (restaurantId: string) => ['ops', 'restaurants', restaurantId, 'hours'] as const,
    servicePeriods: (restaurantId: string) => ['ops', 'restaurants', restaurantId, 'service-periods'] as const,
  },
  opsTables: {
    list: (restaurantId: string, params: Record<string, unknown> = {}) =>
      ['ops', 'tables', restaurantId, params] as const,
  },
  opsCapacity: {
    rules: (restaurantId: string) => ['ops', 'capacity', restaurantId, 'rules'] as const,
    overrides: (restaurantId: string, params: Record<string, unknown> = {}) =>
      ['ops', 'capacity', restaurantId, 'overrides', params] as const,
    reports: (restaurantId: string, params: Record<string, unknown> = {}) =>
      ['ops', 'capacity', restaurantId, 'reports', params] as const,
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
  | ReturnType<(typeof queryKeys)['opsDashboard']['summary']>
  | ReturnType<(typeof queryKeys)['opsDashboard']['heatmap']>
  | ReturnType<(typeof queryKeys)['opsCustomers']['list']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['list']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['detail']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['hours']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['servicePeriods']>
  | ReturnType<(typeof queryKeys)['opsTables']['list']>
  | ReturnType<(typeof queryKeys)['opsCapacity']['rules']>
  | ReturnType<(typeof queryKeys)['opsCapacity']['overrides']>
  | ReturnType<(typeof queryKeys)['opsCapacity']['reports']>
  | ReturnType<(typeof queryKeys)['ownerRestaurants']['hours']>
  | ReturnType<(typeof queryKeys)['ownerRestaurants']['servicePeriods']>
  | ReturnType<(typeof queryKeys)['ownerRestaurants']['details']>
  | ReturnType<(typeof queryKeys)['profile']['self']>
  | ReturnType<(typeof queryKeys)['restaurants']['list']>
  | ReturnType<(typeof queryKeys)['team']['memberships']>
  | ReturnType<(typeof queryKeys)['team']['invitations']>;
