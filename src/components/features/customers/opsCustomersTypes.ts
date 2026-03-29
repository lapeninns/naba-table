'use client';

import type { CustomerListParams } from '@/services/ops/customers';

export type MarketingFilter = 'all' | 'opted_in' | 'opted_out';
export type LastVisitFilter = 'any' | '30d' | '90d' | '365d' | 'never';
export type SortDirection = 'asc' | 'desc';
export type SortBy = 'last_visit' | 'bookings';
export type SortOption = `${SortBy}_${SortDirection}`;

export type OpsCustomersFilterState = {
  searchTerm: string;
  marketingOptIn: MarketingFilter;
  lastVisit: LastVisitFilter;
  minBookings: number;
  sort: SortDirection;
  sortBy: SortBy;
};

export type OpsCustomersFilterBadge = {
  key: 'search' | 'marketing' | 'lastVisit' | 'minBookings';
  label: string;
};

export type OpsGuestRowViewModel = {
  id: string;
  emailSearchValue: string;
  name: string;
  initials: string;
  isVip: boolean;
  railClass: string;
  visitStatusLabel: string;
  marketingLabel: string;
  marketingBadgeVariant: 'secondary' | 'outline';
  email: string | null;
  phone: string | null;
  primaryContact: string | null;
  telHref: string | null;
  emailHref: string | null;
  emailLabel?: string;
  callLabel?: string;
  lastVisitLabel: string;
  totalBookings: number;
  totalCovers: number;
  totalCancellations: number;
};

export const DEFAULT_CUSTOMERS_FILTER_STATE: OpsCustomersFilterState = {
  searchTerm: '',
  marketingOptIn: 'all',
  lastVisit: 'any',
  minBookings: 0,
  sort: 'desc',
  sortBy: 'last_visit',
};

export const LAST_VISIT_OPTIONS: { value: LastVisitFilter; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last year' },
  { value: 'never', label: 'Never visited' },
];

export const MARKETING_OPTIONS: { value: MarketingFilter; label: string }[] = [
  { value: 'all', label: 'All marketing' },
  { value: 'opted_in', label: 'Opted in' },
  { value: 'opted_out', label: 'Opted out' },
];

export const MIN_BOOKINGS_OPTIONS = [0, 1, 3, 5, 10];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'last_visit_desc', label: 'Most recent visit' },
  { value: 'last_visit_asc', label: 'Oldest visit' },
  { value: 'bookings_desc', label: 'Most bookings' },
  { value: 'bookings_asc', label: 'Fewest bookings' },
];

export const INFINITE_PAGE_SIZE = 50;

export type OpsCustomersExportFilters = Pick<
  CustomerListParams,
  'sortBy' | 'search' | 'marketingOptIn' | 'lastVisit' | 'minBookings'
>;
