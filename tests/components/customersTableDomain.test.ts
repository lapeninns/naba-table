import { describe, expect, it } from 'vitest';

import {
  CUSTOMERS_TABLE_LOAD_MORE_ROW_ESTIMATE,
  CUSTOMERS_TABLE_ROW_ESTIMATE,
  CUSTOMERS_TABLE_VIRTUALIZE_MIN_ITEMS,
  deriveCustomersTableViewState,
  estimateCustomersTableRowSize,
  findCustomersTableFocusTarget,
  shouldLoadMoreCustomers,
  shouldUpdateCustomersTableRowHeight,
} from '@/components/features/customers/customersTableDomain';

import type { OpsGuestRowViewModel } from '@/components/features/customers/opsCustomersTypes';

function makeGuestRow(overrides: Partial<OpsGuestRowViewModel> = {}): OpsGuestRowViewModel {
  return {
    id: 'guest-1',
    emailSearchValue: 'alex@example.com',
    name: 'Alex Johnson',
    initials: 'AJ',
    isVip: false,
    railClass: 'border-l-border',
    visitStatusLabel: 'Returning',
    marketingLabel: 'Opted in',
    marketingBadgeVariant: 'secondary',
    email: 'alex@example.com',
    phone: '555 123 4567',
    primaryContact: 'alex@example.com',
    telHref: 'tel:5551234567',
    emailHref: 'mailto:alex@example.com',
    emailLabel: 'Email Alex Johnson',
    callLabel: 'Call Alex Johnson',
    lastVisitLabel: 'Mar 20, 2026 · 9 days ago',
    totalBookings: 4,
    totalCovers: 12,
    totalCancellations: 1,
    ...overrides,
  };
}

describe('customersTableDomain', () => {
  it('derives loading, empty, total item, and virtualization state', () => {
    expect(
      deriveCustomersTableViewState({
        hasNextPage: false,
        isLoading: true,
        rowCount: 0,
      }),
    ).toEqual({
      showEmpty: false,
      showSkeleton: true,
      shouldVirtualize: false,
      totalItems: 0,
    });

    expect(
      deriveCustomersTableViewState({
        hasNextPage: true,
        isLoading: false,
        rowCount: 2,
      }),
    ).toMatchObject({
      showEmpty: false,
      showSkeleton: false,
      shouldVirtualize: true,
      totalItems: 3,
    });

    expect(
      deriveCustomersTableViewState({
        hasNextPage: false,
        isLoading: false,
        rowCount: CUSTOMERS_TABLE_VIRTUALIZE_MIN_ITEMS,
      }).shouldVirtualize,
    ).toBe(true);
  });

  it('estimates data rows and load-more rows consistently', () => {
    expect(
      estimateCustomersTableRowSize({
        index: 0,
        rowCount: 3,
      }),
    ).toBe(CUSTOMERS_TABLE_ROW_ESTIMATE);

    expect(
      estimateCustomersTableRowSize({
        cachedHeight: 260,
        index: 0,
        rowCount: 3,
      }),
    ).toBe(260);

    expect(
      estimateCustomersTableRowSize({
        index: 3,
        rowCount: 3,
      }),
    ).toBe(CUSTOMERS_TABLE_LOAD_MORE_ROW_ESTIMATE);
  });

  it('detects when virtual scrolling should load the next page', () => {
    expect(
      shouldLoadMoreCustomers({
        hasNextPage: true,
        isFetchingNextPage: false,
        lastVirtualIndex: 9,
        rowCount: 10,
        shouldVirtualize: true,
      }),
    ).toBe(true);

    expect(
      shouldLoadMoreCustomers({
        hasNextPage: true,
        isFetchingNextPage: true,
        lastVirtualIndex: 9,
        rowCount: 10,
        shouldVirtualize: true,
      }),
    ).toBe(false);

    expect(
      shouldLoadMoreCustomers({
        hasNextPage: false,
        isFetchingNextPage: false,
        lastVirtualIndex: 9,
        rowCount: 10,
        shouldVirtualize: true,
      }),
    ).toBe(false);
  });

  it('resolves focus targets by exact id or normalized email search value', () => {
    const rows = [
      makeGuestRow(),
      makeGuestRow({
        id: 'guest-2',
        emailSearchValue: 'sam@example.com',
        name: 'Sam Patel',
      }),
    ];

    expect(findCustomersTableFocusTarget({ focusCustomerId: 'guest-2', rows })).toEqual({
      id: 'guest-2',
      index: 1,
    });
    expect(findCustomersTableFocusTarget({ focusCustomerId: 'SAM@EXAMPLE.COM', rows })).toEqual({
      id: 'guest-2',
      index: 1,
    });
    expect(findCustomersTableFocusTarget({ focusCustomerId: 'missing', rows })).toBeNull();
  });

  it('updates row height cache only when measurement changes meaningfully', () => {
    expect(
      shouldUpdateCustomersTableRowHeight({
        cachedHeight: undefined,
        measuredHeight: 220,
      }),
    ).toBe(true);
    expect(
      shouldUpdateCustomersTableRowHeight({
        cachedHeight: 220,
        measuredHeight: 220.5,
      }),
    ).toBe(false);
    expect(
      shouldUpdateCustomersTableRowHeight({
        cachedHeight: 220,
        measuredHeight: 223,
      }),
    ).toBe(true);
  });
});
