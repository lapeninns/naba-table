import type { RestaurantFilters } from '@/lib/restaurants/types';
import type {
  OpsSmsDeliveryRange,
  SmsDeliveryChannelFilter,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';

export const queryKeys = {
  account: {
    sessions: () => ['account', 'sessions'] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    list: (params: Record<string, unknown> = {}) => ['bookings', 'list', params] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
    history: (id: string, params: Record<string, unknown> = {}) =>
      ['bookings', 'history', id, params] as const,
  },
  opsBookings: {
    all: ['ops', 'bookings'] as const,
    list: (params: Record<string, unknown> = {}) => ['ops', 'bookings', 'list', params] as const,
    detail: (id: string) => ['ops', 'bookings', 'detail', id] as const,
    assignmentContext: (id: string) => ['ops', 'bookings', 'assignment-context', id] as const,
  },
  opsDashboard: {
    summary: (restaurantId: string, date?: string | null) =>
      ['ops', 'dashboard', restaurantId, 'summary', date ?? 'today'] as const,
    heatmap: (restaurantId: string, start: string, end: string) =>
      ['ops', 'dashboard', restaurantId, 'heatmap', start, end] as const,
  },
  opsSettings: {
    strategicConfig: (restaurantId: string) =>
      ['ops', 'settings', 'strategic-config', restaurantId] as const,
  },
  opsCustomers: {
    list: (params: Record<string, unknown> = {}) => ['ops', 'customers', 'list', params] as const,
  },
  opsRestaurants: {
    all: ['ops', 'restaurants'] as const,
    list: (params: Record<string, unknown> = {}) => ['ops', 'restaurants', 'list', params] as const,
    detail: (id: string) => ['ops', 'restaurants', 'detail', id] as const,
    businessContext: (restaurantId: string) =>
      ['ops', 'restaurants', restaurantId, 'business-context'] as const,
    googleBusinessProfile: (restaurantId: string) =>
      ['ops', 'restaurants', restaurantId, 'google-business-profile'] as const,
    googleBusinessProfileLocations: (restaurantId: string) =>
      ['ops', 'restaurants', restaurantId, 'google-business-profile', 'locations'] as const,
    hours: (restaurantId: string) => ['ops', 'restaurants', restaurantId, 'hours'] as const,
    servicePeriods: (restaurantId: string) =>
      ['ops', 'restaurants', restaurantId, 'service-periods'] as const,
    turnBands: (restaurantId: string) =>
      ['ops', 'restaurants', restaurantId, 'turn-bands'] as const,
    emailTemplates: (restaurantId: string) =>
      ['ops', 'restaurants', restaurantId, 'email-templates'] as const,
  },
  opsTables: {
    list: (restaurantId: string, params: Record<string, unknown> = {}) =>
      ['ops', 'tables', restaurantId, params] as const,
    timeline: (restaurantId: string, params: Record<string, unknown> = {}) =>
      ['ops', 'tables', restaurantId, 'timeline', params] as const,
    allowedCapacities: (restaurantId: string) =>
      ['ops', 'tables', restaurantId, 'allowed-capacities'] as const,
    zones: (restaurantId: string) => ['ops', 'tables', restaurantId, 'zones'] as const,
  },
  opsOperationsHub: {
    detail: (restaurantId: string) => ['ops', 'operations-hub', 'detail', restaurantId] as const,
  },
  opsOccasions: {
    list: () => ['ops', 'occasions', 'list'] as const,
  },
  opsMenuHierarchy: {
    list: (restaurantId: string) => ['ops', 'menu-hierarchy', restaurantId, 'list'] as const,
  },
  opsSmsDelivery: {
    restaurantFeed: (params: {
      restaurantId: string;
      range: OpsSmsDeliveryRange;
      page: number;
      pageSize: number;
      statuses: readonly SmsDeliveryStatus[];
      channel?: SmsDeliveryChannelFilter;
    }) =>
      [
        'ops',
        'sms-delivery',
        'restaurant-feed',
        params.restaurantId,
        params.range,
        params.page,
        params.pageSize,
        params.statuses.join(','),
        params.channel ?? 'all',
      ] as const,
    bookingLog: (bookingId: string, limit: number) =>
      ['ops', 'sms-delivery', 'booking-log', bookingId, limit] as const,
  },
  manualAssign: {
    context: (bookingId: string) => ['ops', 'manual-assign', 'context', bookingId] as const,
  },
  ownerRestaurants: {
    hours: (restaurantId: string) => ['owner', 'restaurants', restaurantId, 'hours'] as const,
    servicePeriods: (restaurantId: string) =>
      ['owner', 'restaurants', restaurantId, 'service-periods'] as const,
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
    /** Prefix covering every invitation status list for one restaurant. */
    invitationsForRestaurant: (restaurantId: string) =>
      ['team', 'invitations', restaurantId] as const,
  },
};

export type QueryKey =
  | ReturnType<(typeof queryKeys)['account']['sessions']>
  | ReturnType<(typeof queryKeys)['bookings']['list']>
  | ReturnType<(typeof queryKeys)['bookings']['detail']>
  | ReturnType<(typeof queryKeys)['bookings']['history']>
  | ReturnType<(typeof queryKeys)['opsBookings']['list']>
  | ReturnType<(typeof queryKeys)['opsBookings']['detail']>
  | ReturnType<(typeof queryKeys)['opsBookings']['assignmentContext']>
  | ReturnType<(typeof queryKeys)['opsDashboard']['summary']>
  | ReturnType<(typeof queryKeys)['opsDashboard']['heatmap']>
  | ReturnType<(typeof queryKeys)['opsSettings']['strategicConfig']>
  | ReturnType<(typeof queryKeys)['opsCustomers']['list']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['list']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['detail']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['businessContext']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['googleBusinessProfile']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['googleBusinessProfileLocations']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['hours']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['servicePeriods']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['turnBands']>
  | ReturnType<(typeof queryKeys)['opsRestaurants']['emailTemplates']>
  | ReturnType<(typeof queryKeys)['opsTables']['list']>
  | ReturnType<(typeof queryKeys)['opsTables']['timeline']>
  | ReturnType<(typeof queryKeys)['opsTables']['allowedCapacities']>
  | ReturnType<(typeof queryKeys)['opsTables']['zones']>
  | ReturnType<(typeof queryKeys)['opsOperationsHub']['detail']>
  | ReturnType<(typeof queryKeys)['opsOccasions']['list']>
  | ReturnType<(typeof queryKeys)['opsMenuHierarchy']['list']>
  | ReturnType<(typeof queryKeys)['opsSmsDelivery']['restaurantFeed']>
  | ReturnType<(typeof queryKeys)['opsSmsDelivery']['bookingLog']>
  | ReturnType<(typeof queryKeys)['ownerRestaurants']['hours']>
  | ReturnType<(typeof queryKeys)['ownerRestaurants']['servicePeriods']>
  | ReturnType<(typeof queryKeys)['ownerRestaurants']['details']>
  | ReturnType<(typeof queryKeys)['profile']['self']>
  | ReturnType<(typeof queryKeys)['restaurants']['list']>
  | ReturnType<(typeof queryKeys)['team']['memberships']>
  | ReturnType<(typeof queryKeys)['team']['invitations']>
  | ReturnType<(typeof queryKeys)['team']['invitationsForRestaurant']>
  | ReturnType<(typeof queryKeys)['manualAssign']['context']>;
