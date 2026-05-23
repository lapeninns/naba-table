import {
  DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES,
  buildOpsDateRange,
  buildOpsTimeWindowRange,
  sanitizeTimeParam,
  type OpsDateRange,
} from '@/utils/ops/bookings';
import { buildOpsBookingsFilters } from '@/utils/ops/buildOpsBookingsFilters';
import { sanitizeDateParam } from '@/utils/ops/dashboard';

import type { OpsBookingsWindowMode } from './opsBookingsTypes';
import type { OpsStatusFilter } from '@/hooks/ops/useOpsBookingsTableState';
import type { OpsBookingsFilters, OpsBookingStatus } from '@/types/ops';
import type { OpsBookingsView } from '@/utils/ops/buildOpsBookingsFilters';

export const DEFAULT_OPS_BOOKINGS_FILTER: OpsStatusFilter = 'upcoming';
const MIN_WINDOW_MINUTES = 15;
const MAX_WINDOW_MINUTES = 240;

export function getOpsBookingsBasePath(pathname: string | null): string {
  return pathname?.startsWith('/app') ? '/app' : '';
}

export function resolveOpsBookingsRestaurantName({
  accountRestaurantName,
  activeMembershipRestaurantName,
}: {
  accountRestaurantName?: string | null;
  activeMembershipRestaurantName?: string | null;
}): string {
  return activeMembershipRestaurantName ?? accountRestaurantName ?? 'This restaurant';
}

export function buildOpsBookingsTableFilterChips({
  resolvedTableLabel,
  resolvedTime,
  resolvedWindowMinutes,
  resolvedWindowMode,
}: {
  resolvedTableLabel: string | null;
  resolvedTime: string | null;
  resolvedWindowMinutes: number;
  resolvedWindowMode: OpsBookingsWindowMode;
}): { key: string; label: string; variant: 'outline' | 'secondary' }[] {
  const chips: { key: string; label: string; variant: 'outline' | 'secondary' }[] = [
    {
      key: 'table',
      label: resolvedTableLabel ?? 'Table filter',
      variant: 'outline',
    },
  ];

  if (resolvedTime) {
    chips.push({ key: 'time', label: resolvedTime, variant: 'secondary' });
  }

  chips.push({
    key: 'window',
    label: resolvedWindowMode === 'window' ? `Nearby ±${resolvedWindowMinutes}m` : 'All day',
    variant: 'secondary',
  });

  return chips;
}

export function isValidOpsBookingsStatusFilter(
  value: string | null,
  listableStatuses: OpsBookingStatus[],
): value is OpsStatusFilter {
  if (!value) return false;
  return ['all', 'upcoming', 'past', 'cancelled', 'recent', ...listableStatuses].includes(value);
}

export function parseOpsBookingsStatusesParam(
  value: string | null,
  listableStatuses: OpsBookingStatus[],
  fallback: OpsBookingStatus[],
): OpsBookingStatus[] {
  if (!value) return fallback;

  return value
    .split(',')
    .map((status) => status.trim())
    .filter((status): status is OpsBookingStatus =>
      listableStatuses.includes(status as OpsBookingStatus),
    );
}

export function resolveOpsBookingsDate(
  params: URLSearchParams,
  initialDate: string | null | undefined,
): string | null {
  return sanitizeDateParam(params.get('date') ?? initialDate);
}

export function resolveOpsBookingsTime(
  params: URLSearchParams,
  initialTime: string | null | undefined,
): string | null {
  return sanitizeTimeParam(params.get('time') ?? initialTime) ?? null;
}

export function resolveOpsBookingsWindowMode({
  initialWindowMode,
  params,
  resolvedTableId,
  resolvedTime,
}: {
  initialWindowMode: OpsBookingsWindowMode | null | undefined;
  params: URLSearchParams;
  resolvedTableId: string | null;
  resolvedTime: string | null;
}): OpsBookingsWindowMode {
  const raw = params.get('windowMode');
  if (raw === 'day' || raw === 'window') return raw;
  if (initialWindowMode === 'day' || initialWindowMode === 'window') return initialWindowMode;
  return resolvedTableId && resolvedTime ? 'window' : 'day';
}

export function resolveOpsBookingsWindowMinutes({
  initialWindowMinutes,
  params,
}: {
  initialWindowMinutes: number | null | undefined;
  params: URLSearchParams;
}): number {
  const fallback =
    typeof initialWindowMinutes === 'number'
      ? initialWindowMinutes
      : DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES;
  const raw = params.get('windowMinutes');
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  if (parsed < MIN_WINDOW_MINUTES || parsed > MAX_WINDOW_MINUTES) return fallback;
  return parsed;
}

export function resolveOpsBookingsStatusFilter({
  initialDate,
  initialFilter,
  listableStatuses,
  params,
}: {
  initialDate: string | null | undefined;
  initialFilter: OpsStatusFilter | null | undefined;
  listableStatuses: OpsBookingStatus[];
  params: URLSearchParams;
}): OpsStatusFilter {
  return (
    (isValidOpsBookingsStatusFilter(params.get('filter'), listableStatuses)
      ? (params.get('filter') as OpsStatusFilter)
      : null) ??
    initialFilter ??
    (initialDate ? 'all' : DEFAULT_OPS_BOOKINGS_FILTER)
  );
}

export function resolveOpsBookingsInitialStatuses({
  initialStatuses,
  listableStatuses,
  params,
}: {
  initialStatuses: OpsBookingStatus[] | null | undefined;
  listableStatuses: OpsBookingStatus[];
  params: URLSearchParams;
}): OpsBookingStatus[] {
  return parseOpsBookingsStatusesParam(
    params.get('statuses'),
    listableStatuses,
    (initialStatuses ?? []).filter((status) => listableStatuses.includes(status)),
  );
}

export function resolveOpsBookingsView({
  defaultView,
  statusFilter,
}: {
  defaultView: OpsBookingsView;
  statusFilter: OpsStatusFilter;
}): OpsBookingsView {
  switch (statusFilter) {
    case 'recent':
    case 'upcoming':
    case 'all':
    case 'past':
    case 'cancelled':
      return statusFilter;
    default:
      return defaultView;
  }
}

export function filterVisibleOpsBookingsStatuses(
  selectedStatuses: OpsBookingStatus[],
  listableStatuses: OpsBookingStatus[],
): OpsBookingStatus[] {
  return selectedStatuses.filter((status) => listableStatuses.includes(status));
}

export function buildOpsBookingsUpdatedSearchParams({
  currentSearch,
  updates,
}: {
  currentSearch: string;
  updates: Record<string, string | null>;
}): string {
  const nextParams = new URLSearchParams(currentSearch);
  nextParams.delete('page');
  nextParams.delete('pageSize');
  nextParams.delete('status');

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
  }

  return nextParams.toString();
}

export function buildOpsBookingsToggledStatuses({
  status,
  visibleSelectedStatuses,
}: {
  status: OpsBookingStatus;
  visibleSelectedStatuses: OpsBookingStatus[];
}): OpsBookingStatus[] {
  const exists = visibleSelectedStatuses.includes(status);
  const next = exists
    ? visibleSelectedStatuses.filter((value) => value !== status)
    : [...visibleSelectedStatuses, status];

  return Array.from(new Set(next));
}

export function shouldShowOpsBookingsReset(params: {
  focusBookingId: string | null;
  resolvedTableId: string | null;
  resolvedTime: string | null;
  search: string;
  selectedDate: string | null;
  statusFilter: OpsStatusFilter;
  defaultStatusFilter: OpsStatusFilter;
  visibleSelectedStatuses: OpsBookingStatus[];
}): boolean {
  return (
    params.search.trim().length > 0 ||
    params.visibleSelectedStatuses.length > 0 ||
    Boolean(params.selectedDate) ||
    Boolean(params.resolvedTableId) ||
    Boolean(params.resolvedTime) ||
    Boolean(params.focusBookingId) ||
    params.statusFilter !== params.defaultStatusFilter
  );
}

export function clampOpsBookingsWindowMinutes(value: number | null | undefined): number {
  return Math.min(
    MAX_WINDOW_MINUTES,
    Math.max(MIN_WINDOW_MINUTES, value || DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES),
  );
}

export function resolveOpsBookingsAppliedDateRange(params: {
  selectedDate: string | null;
  resolvedTime: string | null;
  resolvedWindowMode: OpsBookingsWindowMode;
  resolvedWindowMinutes: number | null | undefined;
  restaurantTimezone: string | null;
}): OpsDateRange | null {
  const safeWindowMinutes = clampOpsBookingsWindowMinutes(params.resolvedWindowMinutes);

  if (params.resolvedWindowMode === 'window' && params.resolvedTime) {
    const windowRange = buildOpsTimeWindowRange(
      params.selectedDate,
      params.resolvedTime,
      safeWindowMinutes,
      params.restaurantTimezone,
    );
    if (windowRange) return windowRange;
  }

  return buildOpsDateRange(params.selectedDate, params.restaurantTimezone);
}

export function buildOpsBookingsListFilters(params: {
  restaurantId: string | null;
  view: OpsBookingsView;
  appliedDateRange: OpsDateRange | null;
  now: Date;
  deferredSearch: string;
  visibleSelectedStatuses: OpsBookingStatus[];
  resolvedTableId: string | null;
}): OpsBookingsFilters | null {
  if (!params.restaurantId) return null;

  return buildOpsBookingsFilters({
    restaurantId: params.restaurantId,
    view: params.view,
    scope: params.appliedDateRange
      ? { from: params.appliedDateRange.from, to: params.appliedDateRange.to }
      : null,
    now: params.now,
    query: params.deferredSearch,
    selectedStatuses: params.visibleSelectedStatuses,
    tableId: params.resolvedTableId,
  });
}

export function buildOpsBookingsStatusFilterOptions(params: {
  listableStatuses: OpsBookingStatus[];
  totals: Partial<Record<OpsBookingStatus, number>> | null | undefined;
}): { status: OpsBookingStatus; count: number }[] {
  return params.listableStatuses.map((status) => ({
    status,
    count: params.totals ? (params.totals[status] ?? 0) : 0,
  }));
}
