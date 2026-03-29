'use client';

import { OPS_GUEST_RETURNING_MIN_BOOKINGS, OPS_GUEST_VIP_MIN_BOOKINGS } from '@/lib/ops/customers';

import {
  DEFAULT_CUSTOMERS_FILTER_STATE,
  LAST_VISIT_OPTIONS,
  MARKETING_OPTIONS,
} from './opsCustomersTypes';

import type {
  LastVisitFilter,
  MarketingFilter,
  OpsCustomersFilterBadge,
  OpsCustomersFilterState,
  OpsGuestRowViewModel,
  SortBy,
  SortDirection,
  SortOption,
} from './opsCustomersTypes';
import type { OpsCustomer } from '@/types/ops';

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const relativeFormatterCache = new Map<string, Intl.RelativeTimeFormat>();

export function isMarketingFilter(value: string | null): value is MarketingFilter {
  return value === 'all' || value === 'opted_in' || value === 'opted_out';
}

export function isLastVisitFilter(value: string | null): value is LastVisitFilter {
  return (
    value === 'any' || value === '30d' || value === '90d' || value === '365d' || value === 'never'
  );
}

export function isSort(value: string | null): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

export function isSortBy(value: string | null): value is SortBy {
  return value === 'last_visit' || value === 'bookings';
}

export function encodeSortOption(sortBy: SortBy, sort: SortDirection): SortOption {
  return `${sortBy}_${sort}`;
}

export function decodeSortOption(option: SortOption): { sortBy: SortBy; sort: SortDirection } {
  const separatorIndex = option.lastIndexOf('_');
  const sortBy = separatorIndex >= 0 ? option.slice(0, separatorIndex) : option;
  const sort = separatorIndex >= 0 ? option.slice(separatorIndex + 1) : option;
  return {
    sortBy: isSortBy(sortBy) ? sortBy : DEFAULT_CUSTOMERS_FILTER_STATE.sortBy,
    sort: isSort(sort) ? sort : DEFAULT_CUSTOMERS_FILTER_STATE.sort,
  };
}

export function parseOpsCustomersQueryState(searchParams: string): OpsCustomersFilterState {
  const params = new URLSearchParams(searchParams);
  const minBookingsParam = Number.parseInt(params.get('minBookings') ?? '0', 10);

  return {
    searchTerm: params.get('search') ?? DEFAULT_CUSTOMERS_FILTER_STATE.searchTerm,
    marketingOptIn: isMarketingFilter(params.get('marketingOptIn'))
      ? (params.get('marketingOptIn') as MarketingFilter)
      : DEFAULT_CUSTOMERS_FILTER_STATE.marketingOptIn,
    lastVisit: isLastVisitFilter(params.get('lastVisit'))
      ? (params.get('lastVisit') as LastVisitFilter)
      : DEFAULT_CUSTOMERS_FILTER_STATE.lastVisit,
    minBookings: Number.isFinite(minBookingsParam) ? Math.max(0, minBookingsParam) : 0,
    sort: isSort(params.get('sort'))
      ? (params.get('sort') as SortDirection)
      : DEFAULT_CUSTOMERS_FILTER_STATE.sort,
    sortBy: isSortBy(params.get('sortBy'))
      ? (params.get('sortBy') as SortBy)
      : DEFAULT_CUSTOMERS_FILTER_STATE.sortBy,
  };
}

export function buildOpsCustomersQueryString(
  currentQueryString: string,
  nextState: Pick<
    OpsCustomersFilterState,
    'marketingOptIn' | 'lastVisit' | 'minBookings' | 'sort' | 'sortBy'
  > & { search: string | null },
): string {
  const params = new URLSearchParams(currentQueryString);
  params.delete('page');

  const applyParam = (
    key: string,
    value: string | number | null | undefined,
    defaultValue?: string | number,
  ) => {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (defaultValue !== undefined && value === defaultValue)
    ) {
      params.delete(key);
      return;
    }
    params.set(key, String(value));
  };

  applyParam('search', nextState.search, '');
  applyParam('marketingOptIn', nextState.marketingOptIn, DEFAULT_CUSTOMERS_FILTER_STATE.marketingOptIn);
  applyParam('lastVisit', nextState.lastVisit, DEFAULT_CUSTOMERS_FILTER_STATE.lastVisit);
  applyParam('minBookings', nextState.minBookings, DEFAULT_CUSTOMERS_FILTER_STATE.minBookings);
  applyParam('sortBy', nextState.sortBy, DEFAULT_CUSTOMERS_FILTER_STATE.sortBy);
  applyParam('sort', nextState.sort, DEFAULT_CUSTOMERS_FILTER_STATE.sort);

  return params.toString();
}

export function describeMarketingFilter(value: MarketingFilter): string {
  return MARKETING_OPTIONS.find((option) => option.value === value)?.label ?? 'All marketing';
}

export function describeLastVisitFilter(value: LastVisitFilter): string {
  return LAST_VISIT_OPTIONS.find((option) => option.value === value)?.label ?? 'Any time';
}

export function buildOpsCustomersFilterBadges({
  searchTerm,
  marketingOptIn,
  lastVisit,
  minBookings,
}: Pick<OpsCustomersFilterState, 'searchTerm' | 'marketingOptIn' | 'lastVisit' | 'minBookings'>): OpsCustomersFilterBadge[] {
  const trimmedSearch = searchTerm.trim();

  return [
    trimmedSearch
      ? {
          key: 'search' as const,
          label: `Search: "${trimmedSearch}"`,
        }
      : null,
    marketingOptIn !== DEFAULT_CUSTOMERS_FILTER_STATE.marketingOptIn
      ? {
          key: 'marketing' as const,
          label: describeMarketingFilter(marketingOptIn),
        }
      : null,
    lastVisit !== DEFAULT_CUSTOMERS_FILTER_STATE.lastVisit
      ? {
          key: 'lastVisit' as const,
          label: describeLastVisitFilter(lastVisit),
        }
      : null,
    minBookings > 0
      ? {
          key: 'minBookings' as const,
          label: `Min bookings ${minBookings}`,
        }
      : null,
  ].filter((badge): badge is OpsCustomersFilterBadge => Boolean(badge));
}

function getDateFormatter(localeKey: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${localeKey}:${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(undefined, options);
  formatterCache.set(key, formatter);
  return formatter;
}

function getRelativeFormatter(localeKey: string): Intl.RelativeTimeFormat {
  const cached = relativeFormatterCache.get(localeKey);
  if (cached) return cached;

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  relativeFormatterCache.set(localeKey, formatter);
  return formatter;
}

function formatLastVisit(value: string | null): string {
  if (!value) {
    return 'Never visited';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Never visited';
  }

  const absolute = getDateFormatter('guest-last-visit', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const relative =
    Math.abs(diffDays) <= 365
      ? getRelativeFormatter('guest-last-visit-relative').format(diffDays, 'day')
      : null;

  return relative ? `${absolute} · ${relative}` : absolute;
}

function toTelHref(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[()\s.-]+/g, '');
  return normalized ? `tel:${normalized}` : null;
}

function initialsFromName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

  return initials || 'G';
}

export function buildOpsGuestRowViewModels(customers: OpsCustomer[]): OpsGuestRowViewModel[] {
  return customers.map((customer) => {
    const isVip = customer.totalBookings >= OPS_GUEST_VIP_MIN_BOOKINGS;
    const isReturning = customer.totalBookings >= OPS_GUEST_RETURNING_MIN_BOOKINGS;
    const neverVisited = !customer.lastBookingAt;
    const email = customer.email?.trim() || null;
    const phone = customer.phone?.trim() || null;
    const telHref = phone ? toTelHref(phone) : null;

    return {
      id: customer.id,
      emailSearchValue: email?.toLowerCase() ?? '',
      name: customer.name,
      initials: initialsFromName(customer.name),
      isVip,
      railClass: isVip
        ? 'border-l-primary'
        : isReturning
          ? 'border-l-emerald-500'
          : neverVisited
            ? 'border-l-amber-300'
            : 'border-l-border',
      visitStatusLabel: neverVisited ? 'Never visited' : isReturning ? 'Returning' : 'New',
      marketingLabel: customer.marketingOptIn ? 'Opted in' : 'Opted out',
      marketingBadgeVariant: customer.marketingOptIn ? 'secondary' : 'outline',
      email,
      phone,
      primaryContact: email ?? phone,
      telHref,
      emailHref: email ? `mailto:${email}` : null,
      emailLabel: email ? `Email ${customer.name}` : undefined,
      callLabel: telHref ? `Call ${customer.name}` : undefined,
      lastVisitLabel: formatLastVisit(customer.lastBookingAt),
      totalBookings: customer.totalBookings,
      totalCovers: customer.totalCovers,
      totalCancellations: customer.totalCancellations,
    };
  });
}
