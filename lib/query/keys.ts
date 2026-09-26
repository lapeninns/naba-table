import type { RestaurantFilters } from '@/lib/restaurants/types';
import type { OpsEmailDeliveryRange } from '@/types/emailDelivery';
import type { OpsEmailQueueJobStatus } from '@/types/emailQueue';
import type { ReviewGrowthRange } from '@/types/reviewGrowth';
import type {
  OpsSmsDeliveryRange,
  SmsDeliveryChannelFilter,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';

/** Recipient/message filters shared by the email delivery feed and summary keys. */
type OpsEmailDeliveryKeyFilters = {
  simulateEmailDeliveryError?: boolean;
  recipientEmail?: string;
  messageId?: string;
  bookingRef?: string;
  templateType?: string;
  emailType?: string;
};

const emailDeliveryFilterParts = (filters: OpsEmailDeliveryKeyFilters) =>
  [
    filters.recipientEmail?.trim() ?? '',
    filters.messageId?.trim() ?? '',
    filters.bookingRef?.trim().toUpperCase() ?? '',
    filters.templateType?.trim() ?? '',
    filters.emailType?.trim() ?? '',
  ] as const;

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
    // --- wave 1 (query-core): migrated inline literals ---
    /** Prefix of every ops bookings list page, for setQueriesData/invalidate. */
    listPrefix: () => ['ops', 'bookings', 'list'] as const,
    /** The booking dialog bundle (booking + assignment context) prefetched from the card. */
    dialog: (id: string) => ['ops', 'bookings', 'dialog', id] as const,
    emailDeliveryLog: (bookingId: string | null, limit: number) =>
      ['ops', 'bookings', bookingId ?? 'disabled', 'email-delivery', limit] as const,
    /** `statusKey`: the sorted, de-duplicated statuses joined with ','. */
    statusSummary: (
      restaurantId: string | null,
      from: string | null,
      to: string | null,
      statusKey: string,
    ) =>
      ['ops', 'bookings', 'status-summary', restaurantId ?? 'none', from, to, statusKey] as const,
  },
  opsDashboard: {
    summary: (restaurantId: string, date?: string | null) =>
      ['ops', 'dashboard', restaurantId, 'summary', date ?? 'today'] as const,
    heatmap: (restaurantId: string, start: string, end: string) =>
      ['ops', 'dashboard', restaurantId, 'heatmap', start, end] as const,
    // --- wave 1 (query-core): migrated inline literals ---
    /** Prefix of every heatmap range for one restaurant. */
    heatmapPrefix: (restaurantId: string) => ['ops', 'dashboard', restaurantId, 'heatmap'] as const,
    /** Placeholder key while no restaurant is selected (the query is disabled). */
    summaryDisabled: () => ['ops', 'dashboard', 'summary', 'disabled'] as const,
    /** Placeholder key while the heatmap inputs are incomplete (the query is disabled). */
    heatmapDisabled: () => ['ops', 'dashboard', 'heatmap', 'disabled'] as const,
    // --- wave 2 (integrator): shared prefixes for cross-domain invalidation ---
    /** Prefix of every dashboard query (summaries, heatmaps) for one restaurant. */
    restaurantPrefix: (restaurantId: string) => ['ops', 'dashboard', restaurantId] as const,
    /** Prefix of every summary date for one restaurant. */
    summaryPrefix: (restaurantId: string) => ['ops', 'dashboard', restaurantId, 'summary'] as const,
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
    timelinePrefix: (restaurantId: string) => ['ops', 'tables', restaurantId, 'timeline'] as const,
    // --- wave 1 (query-core): migrated inline literals ---
    /** Placeholder key while no restaurant is selected (the query is disabled). */
    timelineDisabled: () => ['ops', 'tables', 'timeline', 'disabled'] as const,
    // --- wave 2 (integrator) ---
    /** Prefix of every tables query (lists, timelines, zones, capacities) for one restaurant. */
    restaurantPrefix: (restaurantId: string) => ['ops', 'tables', restaurantId] as const,
  },
  /** Mutation keys, so pending floor-plan changes can be read with useMutationState. */
  opsFloorPlan: {
    assignments: (restaurantId: string) =>
      ['ops', 'floor-plan', restaurantId, 'assignment'] as const,
    layout: (restaurantId: string) => ['ops', 'floor-plan', restaurantId, 'layout'] as const,
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
  // --- wave 1 (query-core): domains migrated from inline literals ---
  opsReviewGrowth: {
    summary: (restaurantId: string | null, range: ReviewGrowthRange) =>
      ['ops', 'review-growth', restaurantId ?? 'disabled', range] as const,
  },
  /** Keys embed the recipient search term, so the whole family is PII (lib/query/persist.ts). */
  opsEmailDelivery: {
    feed: (
      params: {
        restaurantId: string | null;
        range: OpsEmailDeliveryRange;
        page: number;
        pageSize: number;
        /** Sorted, comma-joined statuses, or 'all'. */
        statusKey: string;
        fixture?: string;
      } & OpsEmailDeliveryKeyFilters,
    ) =>
      [
        'ops',
        'email-delivery',
        params.restaurantId ?? 'disabled',
        params.range,
        params.page,
        params.pageSize,
        params.statusKey,
        params.simulateEmailDeliveryError ? 'forced-error' : '',
        params.fixture?.trim() ?? '',
        ...emailDeliveryFilterParts(params),
      ] as const,
    summary: (
      params: {
        restaurantId: string | null;
        range: OpsEmailDeliveryRange;
      } & OpsEmailDeliveryKeyFilters,
    ) =>
      [
        'ops',
        'email-delivery-summary',
        params.restaurantId ?? 'disabled',
        params.range,
        params.simulateEmailDeliveryError ? 'forced-error' : '',
        ...emailDeliveryFilterParts(params),
      ] as const,
    // --- wave 2 (S8 comms) ---
    /** Every feed page of one restaurant, for invalidation after a resend. */
    feedPrefix: (restaurantId: string) => ['ops', 'email-delivery', restaurantId] as const,
    /** Every summary variant of one restaurant. */
    summaryPrefix: (restaurantId: string) =>
      ['ops', 'email-delivery-summary', restaurantId] as const,
    /** Every page size of one booking's email log (prefix of `opsBookings.emailDeliveryLog`). */
    bookingLogPrefix: (bookingId: string) =>
      ['ops', 'bookings', bookingId, 'email-delivery'] as const,
  },
  opsEmailQueue: {
    feed: (params: {
      restaurantId: string | null;
      page: number;
      pageSize: number;
      status?: OpsEmailQueueJobStatus;
      fixture?: string;
    }) =>
      [
        'ops',
        'email-queue',
        params.restaurantId ?? 'disabled',
        params.page,
        params.pageSize,
        params.status ?? 'all',
        params.fixture?.trim() ?? '',
      ] as const,
    // --- wave 2 (S8 comms) ---
    /** Every queue page and status filter of one restaurant. */
    feedPrefix: (restaurantId: string) => ['ops', 'email-queue', restaurantId] as const,
  },
  // --- wave 2 (S8 comms) ---
  /** Mutation keys (for useMutationState / isMutating), not query keys. */
  opsEmailDeliveryMutations: {
    retry: () => ['ops', 'email-delivery-mutation', 'retry'] as const,
    cancelQueueJob: () => ['ops', 'email-delivery-mutation', 'queue-cancel'] as const,
    requeueQueueJob: () => ['ops', 'email-delivery-mutation', 'queue-requeue'] as const,
  },
  opsEmailTemplates: {
    /** Rendered preview of one draft; `draftHash` identifies the draft content. */
    preview: (restaurantId: string, templateKey: string, draftHash: string) =>
      ['ops', 'email-template-preview', restaurantId, templateKey, draftHash] as const,
  },
  reservations: {
    /**
     * Prefix of the guest booking schedule (`scheduleQueryKey` in
     * reserve/features/reservations/wizard/services/schedule.ts), whose full key carries the
     * restaurant slug, date and party size.
     */
    schedulePrefix: () => ['reservations', 'schedule'] as const,
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
  | ReturnType<(typeof queryKeys)['manualAssign']['context']>
  | ReturnType<(typeof queryKeys)['opsBookings']['dialog']>
  | ReturnType<(typeof queryKeys)['opsBookings']['emailDeliveryLog']>
  | ReturnType<(typeof queryKeys)['opsBookings']['statusSummary']>
  | ReturnType<(typeof queryKeys)['opsDashboard']['summaryDisabled']>
  | ReturnType<(typeof queryKeys)['opsDashboard']['heatmapDisabled']>
  | ReturnType<(typeof queryKeys)['opsTables']['timelineDisabled']>
  | ReturnType<(typeof queryKeys)['opsReviewGrowth']['summary']>
  | ReturnType<(typeof queryKeys)['opsEmailDelivery']['feed']>
  | ReturnType<(typeof queryKeys)['opsEmailDelivery']['summary']>
  | ReturnType<(typeof queryKeys)['opsEmailQueue']['feed']>
  // --- wave 2 (S8 comms) ---
  | ReturnType<(typeof queryKeys)['opsEmailDelivery']['feedPrefix']>
  | ReturnType<(typeof queryKeys)['opsEmailDelivery']['summaryPrefix']>
  | ReturnType<(typeof queryKeys)['opsEmailDelivery']['bookingLogPrefix']>
  | ReturnType<(typeof queryKeys)['opsEmailQueue']['feedPrefix']>
  | ReturnType<(typeof queryKeys)['opsEmailTemplates']['preview']>;
