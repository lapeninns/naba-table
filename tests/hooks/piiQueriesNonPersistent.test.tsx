import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsRestaurantEmailTemplates } from '@/hooks/ops/useOpsRestaurantEmailTemplates';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { useBookings } from '@/hooks/useBookings';
import { useOpsCustomers } from '@/hooks/useOpsCustomers';
import { fetchJson } from '@/lib/http/fetchJson';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import {
  buildQueryStorageKey,
  configureQueryPersistence,
  shouldPersistQuery,
} from '@/lib/query/persist';

import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: vi.fn(),
}));

const customerListMock = vi.fn();
const listInvitesMock = vi.fn();
const getProfileMock = vi.fn();
const getEmailTemplatesMock = vi.fn();

vi.mock('@/contexts/ops-services', () => ({
  useCustomerService: () => ({ list: customerListMock }),
  useTeamService: () => ({ listInvites: listInvitesMock }),
  useRestaurantService: () => ({
    getProfile: getProfileMock,
    getEmailTemplates: getEmailTemplatesMock,
  }),
}));

// Sentinel strings that must never reach localStorage.
const INVITEE_EMAIL = 'invitee-sentinel@example.test';
const MANAGER_PHONE = '+440000sentinel';
const CONTACT_EMAIL = 'contact-sentinel@example.test';
const TEMPLATE_BODY = 'template-body-sentinel';
const CUSTOMER_EMAIL = 'customer-sentinel@example.test';
const GUEST_NAME = 'Guest Sentinel';
const GUEST_EMAIL = 'guest-sentinel@example.test';
const GUEST_PHONE = '+440000guest';
const STAFF_CONTACT_EMAIL = 'staff-contact-sentinel@example.test';

const INVITES = [{ id: 'invite-1', email: INVITEE_EMAIL, role: 'host', status: 'pending' }];
const PROFILE = {
  id: 'rest-1',
  name: 'Test Restaurant',
  contactEmail: CONTACT_EMAIL,
  contactPhone: MANAGER_PHONE,
  managerName: 'Manager Sentinel',
  managerNotificationPhone: MANAGER_PHONE,
};
const TEMPLATES = {
  restaurantId: 'rest-1',
  canEdit: true,
  groups: [{ body: TEMPLATE_BODY }],
};
const GUEST_BOOKING = {
  id: 'booking-1',
  restaurantId: 'rest-1',
  restaurantName: 'Test Restaurant',
  partySize: 2,
  customerName: GUEST_NAME,
  customerEmail: GUEST_EMAIL,
  customerPhone: GUEST_PHONE,
};
const RESTAURANTS_LIST = {
  items: [
    {
      id: 'rest-1',
      name: 'Test Restaurant',
      contactEmail: STAFF_CONTACT_EMAIL,
      contactPhone: MANAGER_PHONE,
      managerName: 'Manager Sentinel',
      managerNotificationPhone: MANAGER_PHONE,
    },
  ],
  pageInfo: { page: 1, pageSize: 20, total: 1, hasNext: false },
};
const CUSTOMERS_PAGE = {
  items: [{ id: 'customer-1', email: CUSTOMER_EMAIL }],
  pageInfo: { page: 1, pageSize: 50, total: 1, hasNext: false },
};

function findQuery(queryClient: QueryClient, firstKey: string): Query {
  const match = queryClient
    .getQueryCache()
    .getAll()
    .find((query) => Array.isArray(query.queryKey) && query.queryKey[0] === firstKey);
  if (!match) {
    throw new Error(`Expected a cached query starting with "${firstKey}"`);
  }
  return match;
}

function findExactQuery(queryClient: QueryClient, queryKey: QueryKey): Query {
  const match = queryClient.getQueryCache().find({ queryKey, exact: true });
  if (!match) {
    throw new Error(`Expected a cached query for ${JSON.stringify(queryKey)}`);
  }
  return match;
}

function appWrapper(queryClient: QueryClient) {
  return function AppQueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** Every staff/invitee/template/guest family, as prefetchers and cache writes insert them (no meta). */
const PII_PREFETCHES: ReadonlyArray<{ name: string; queryKey: QueryKey; data: unknown }> = [
  {
    name: 'team invitations (pending)',
    queryKey: queryKeys.team.invitations('rest-1', 'pending'),
    data: INVITES,
  },
  {
    name: 'team invitations (all)',
    queryKey: queryKeys.team.invitations('rest-1', 'all'),
    data: INVITES,
  },
  { name: 'restaurant detail', queryKey: queryKeys.opsRestaurants.detail('rest-1'), data: PROFILE },
  {
    name: 'email templates',
    queryKey: queryKeys.opsRestaurants.emailTemplates('rest-1'),
    data: TEMPLATES,
  },
  {
    name: 'customers list',
    queryKey: queryKeys.opsCustomers.list({ restaurantId: 'rest-1' }),
    data: { pages: [CUSTOMERS_PAGE], pageParams: [1] },
  },
  // Guest booking families, as OpsBookingCard / useOpsBookingDialogBundle / mutations
  // insert them (prefetchQuery or setQueryData, never with meta).
  {
    name: 'guest booking detail',
    queryKey: queryKeys.bookings.detail('booking-1'),
    data: GUEST_BOOKING,
  },
  {
    name: 'guest bookings list',
    queryKey: queryKeys.bookings.list({ page: '1' }),
    data: { items: [GUEST_BOOKING], pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false } },
  },
  {
    name: 'ops booking detail',
    queryKey: queryKeys.opsBookings.detail('booking-1'),
    data: GUEST_BOOKING,
  },
  {
    name: 'ops booking dialog bundle',
    queryKey: ['ops', 'bookings', 'dialog', 'booking-1'],
    data: { booking: GUEST_BOOKING, assignmentContext: { tables: [] } },
  },
  {
    name: 'ops bookings list',
    queryKey: queryKeys.opsBookings.list({ restaurantId: 'rest-1' }),
    data: { pages: [{ items: [GUEST_BOOKING] }], pageParams: [1] },
  },
  {
    name: 'ops booking email delivery log',
    queryKey: ['ops', 'bookings', 'booking-1', 'email-delivery', 20],
    data: { ok: true, bookingId: 'booking-1', events: [{ recipientEmail: GUEST_EMAIL }] },
  },
  {
    name: 'ops dashboard summary',
    queryKey: queryKeys.opsDashboard.summary('rest-1', null),
    data: { restaurantId: 'rest-1', bookings: [GUEST_BOOKING] },
  },
  {
    name: 'ops restaurants list',
    queryKey: queryKeys.opsRestaurants.list({ page: 1 }),
    data: RESTAURANTS_LIST,
  },
];

describe('PII-bearing query caches are marked non-persistent', () => {
  beforeEach(() => {
    vi.mocked(fetchJson).mockResolvedValue({
      items: [],
      pageInfo: { page: 1, pageSize: 10, total: 0, hasNext: false },
    } as never);
    customerListMock.mockResolvedValue({
      items: [],
      pageInfo: { page: 1, pageSize: 50, total: 0, hasNext: false },
    });
    listInvitesMock.mockResolvedValue(INVITES);
    getProfileMock.mockResolvedValue(PROFILE);
    getEmailTemplatesMock.mockResolvedValue(TEMPLATES);
  });

  afterEach(() => {
    customerListMock.mockReset();
    listInvitesMock.mockReset();
    getProfileMock.mockReset();
    getEmailTemplatesMock.mockReset();
  });

  it('useBookings tags its query with meta.persist=false and is excluded from persistence', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useBookings({ page: 1, pageSize: 10 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = findQuery(queryClient, 'bookings');
    expect(query.meta?.persist).toBe(false);
    expect(shouldPersistQuery(query)).toBe(false);
  });

  it('useOpsCustomers tags its query with meta.persist=false and is excluded from persistence', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useOpsCustomers({ restaurantId: 'rest-1', pageSize: 50 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = findQuery(queryClient, 'ops');
    expect(query.meta?.persist).toBe(false);
    expect(shouldPersistQuery(query)).toBe(false);
  });

  it.each([
    {
      name: 'useOpsTeamInvitations',
      useHook: () => useOpsTeamInvitations({ restaurantId: 'rest-1', status: 'all' }),
      queryKey: queryKeys.team.invitations('rest-1', 'all'),
    },
    {
      name: 'useOpsRestaurantDetails',
      useHook: () => useOpsRestaurantDetails('rest-1'),
      queryKey: queryKeys.opsRestaurants.detail('rest-1'),
    },
    {
      name: 'useOpsRestaurantEmailTemplates',
      useHook: () => useOpsRestaurantEmailTemplates('rest-1'),
      queryKey: queryKeys.opsRestaurants.emailTemplates('rest-1'),
    },
  ])(
    '$name tags its query with meta.persist=false and is excluded from persistence',
    async ({ useHook, queryKey }) => {
      const queryClient = createAppQueryClient();

      const { result } = renderHook(useHook, { wrapper: appWrapper(queryClient) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = findExactQuery(queryClient, queryKey);
      expect(query.meta?.persist).toBe(false);
      expect(shouldPersistQuery(query)).toBe(false);
    },
  );

  it.each(PII_PREFETCHES)(
    'excludes $name when it is prefetched without meta',
    async ({ queryKey, data }) => {
      const queryClient = createAppQueryClient();

      await queryClient.prefetchQuery({ queryKey, queryFn: () => data });

      const query = findExactQuery(queryClient, queryKey);
      expect(query.meta?.persist).toBeUndefined();
      expect(shouldPersistQuery(query)).toBe(false);
    },
  );
});

describe('PII-bearing queries never reach the persisted cache', () => {
  const storageKey = buildQueryStorageKey('user-pii');
  let queryClient: QueryClient;
  let unsubscribe: () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    window.localStorage.clear();
    queryClient = createAppQueryClient();
    unsubscribe = configureQueryPersistence(queryClient, { storageKey });
    // Let the async restore resolve so cache subscriptions are attached.
    await vi.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    unsubscribe();
    queryClient.clear();
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('writes an unrelated settings key but none of the staff, invitee, template, customer or guest families', async () => {
    const hoursKey = queryKeys.opsRestaurants.hours('rest-1');
    await queryClient.prefetchQuery({
      queryKey: hoursKey,
      queryFn: () => ({ weekly: [{ dayOfWeek: 1, opensAt: '09:00' }] }),
    });
    for (const { queryKey, data } of PII_PREFETCHES) {
      await queryClient.prefetchQuery({ queryKey, queryFn: () => data });
    }

    await vi.advanceTimersByTimeAsync(1000);

    const raw = window.localStorage.getItem(storageKey);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? '{}') as {
      clientState: { queries: Array<{ queryKey: QueryKey }> };
    };
    const storedKeys = stored.clientState.queries.map((query) => JSON.stringify(query.queryKey));

    expect(storedKeys).toEqual([JSON.stringify(hoursKey)]);
    for (const sentinel of [
      INVITEE_EMAIL,
      MANAGER_PHONE,
      CONTACT_EMAIL,
      TEMPLATE_BODY,
      CUSTOMER_EMAIL,
      GUEST_NAME,
      GUEST_EMAIL,
      GUEST_PHONE,
      STAFF_CONTACT_EMAIL,
    ]) {
      expect(raw).not.toContain(sentinel);
    }
  });
});
