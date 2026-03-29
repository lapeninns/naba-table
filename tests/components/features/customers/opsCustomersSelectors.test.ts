import { describe, expect, it, vi } from 'vitest';

import {
  buildOpsCustomersFilterBadges,
  buildOpsCustomersQueryString,
  buildOpsGuestRowViewModels,
  parseOpsCustomersQueryState,
} from '@/components/features/customers/opsCustomersSelectors';

import type { OpsCustomer } from '@/types/ops';

function makeCustomer(overrides: Partial<OpsCustomer> = {}): OpsCustomer {
  return {
    id: 'guest-1',
    restaurantId: 'rest-1',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    phone: '(555) 123-4567',
    marketingOptIn: true,
    createdAt: '2026-03-01T12:00:00Z',
    firstBookingAt: '2026-03-10T18:00:00Z',
    lastBookingAt: '2026-03-20T18:00:00Z',
    totalBookings: 6,
    totalCovers: 20,
    totalCancellations: 1,
    ...overrides,
  };
}

describe('opsCustomersSelectors', () => {
  it('parses query params with defaults and invalid fallbacks', () => {
    expect(
      parseOpsCustomersQueryState(
        'search=alex&marketingOptIn=opted_in&lastVisit=30d&minBookings=3&sort=asc&sortBy=bookings',
      ),
    ).toEqual({
      searchTerm: 'alex',
      marketingOptIn: 'opted_in',
      lastVisit: '30d',
      minBookings: 3,
      sort: 'asc',
      sortBy: 'bookings',
    });

    expect(
      parseOpsCustomersQueryState('marketingOptIn=bad&lastVisit=bad&sort=bad&sortBy=bad'),
    ).toEqual({
      searchTerm: '',
      marketingOptIn: 'all',
      lastVisit: 'any',
      minBookings: 0,
      sort: 'desc',
      sortBy: 'last_visit',
    });
  });

  it('builds query strings while preserving unrelated params and removing defaults', () => {
    const query = buildOpsCustomersQueryString('focus=guest-1&page=2', {
      search: 'alex',
      marketingOptIn: 'opted_in',
      lastVisit: '90d',
      minBookings: 3,
      sort: 'asc',
      sortBy: 'bookings',
    });

    expect(query).toBe(
      'focus=guest-1&search=alex&marketingOptIn=opted_in&lastVisit=90d&minBookings=3&sortBy=bookings&sort=asc',
    );

    const defaults = buildOpsCustomersQueryString('focus=guest-1&page=2', {
      search: null,
      marketingOptIn: 'all',
      lastVisit: 'any',
      minBookings: 0,
      sort: 'desc',
      sortBy: 'last_visit',
    });

    expect(defaults).toBe('focus=guest-1');
  });

  it('builds active filter badges from non-default filters', () => {
    expect(
      buildOpsCustomersFilterBadges({
        searchTerm: ' alex ',
        marketingOptIn: 'opted_out',
        lastVisit: '30d',
        minBookings: 5,
      }),
    ).toEqual([
      { key: 'search', label: 'Search: "alex"' },
      { key: 'marketing', label: 'Opted out' },
      { key: 'lastVisit', label: 'Last 30 days' },
      { key: 'minBookings', label: 'Min bookings 5' },
    ]);
  });

  it('builds guest row view models with precomputed display state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'));

    const [row] = buildOpsGuestRowViewModels([makeCustomer()]);

    expect(row).toMatchObject({
      id: 'guest-1',
      emailSearchValue: 'alex@example.com',
      initials: 'AJ',
      isVip: true,
      railClass: 'border-l-primary',
      visitStatusLabel: 'Returning',
      marketingLabel: 'Opted in',
      marketingBadgeVariant: 'secondary',
      primaryContact: 'alex@example.com',
      telHref: 'tel:5551234567',
      emailHref: 'mailto:alex@example.com',
      totalBookings: 6,
      totalCovers: 20,
      totalCancellations: 1,
    });
    expect(row.lastVisitLabel).toContain('Mar');

    vi.useRealTimers();
  });

  it('marks never-visited guests with fallback labels', () => {
    const [row] = buildOpsGuestRowViewModels([
      makeCustomer({
        id: 'guest-2',
        name: 'Solo Guest',
        email: '',
        phone: '',
        marketingOptIn: false,
        lastBookingAt: null,
        totalBookings: 0,
      }),
    ]);

    expect(row).toMatchObject({
      id: 'guest-2',
      initials: 'SG',
      visitStatusLabel: 'Never visited',
      marketingLabel: 'Opted out',
      marketingBadgeVariant: 'outline',
      primaryContact: null,
      telHref: null,
      emailHref: null,
      lastVisitLabel: 'Never visited',
      railClass: 'border-l-amber-300',
    });
  });
});
