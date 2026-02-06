import type { OpsBookingStatus, OpsBookingsFilters } from '@/types/ops';

export type OpsBookingsScope = {
  from: string;
  to: string;
};

export type OpsBookingsView = 'recent' | 'upcoming' | 'all' | 'past' | 'cancelled';

const UPCOMING_STATUSES: OpsBookingStatus[] = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'PRIORITY_WAITLIST',
] as const;

function toDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function maxIso(aIso: string, bIso: string): string {
  const a = toDate(aIso);
  const b = toDate(bIso);
  if (!a && !b) return aIso;
  if (!a) return bIso;
  if (!b) return aIso;
  return a.getTime() >= b.getTime() ? aIso : bIso;
}

function minIso(aIso: string, bIso: string): string {
  const a = toDate(aIso);
  const b = toDate(bIso);
  if (!a && !b) return aIso;
  if (!a) return bIso;
  if (!b) return aIso;
  return a.getTime() <= b.getTime() ? aIso : bIso;
}

type BuildOpsBookingsFiltersParams = {
  restaurantId: string;
  view: OpsBookingsView;
  scope: OpsBookingsScope | null;
  now: Date;
  query: string;
  selectedStatuses: OpsBookingStatus[];
  tableId: string | null;
};

/**
 * Build filters for the ops bookings list API while keeping a single, canonical interpretation
 * of (view + date/window scope + advanced filters).
 */
export function buildOpsBookingsFilters(params: BuildOpsBookingsFiltersParams): OpsBookingsFilters {
  const scopeFrom = params.scope?.from ?? null;
  const scopeTo = params.scope?.to ?? null;
  const nowIso = params.now.toISOString();

  const filters: OpsBookingsFilters = {
    restaurantId: params.restaurantId,
    pageSize: 50,
  };

  if (params.tableId) {
    filters.tableId = params.tableId;
  }

  const trimmedQuery = params.query.trim();
  if (trimmedQuery) {
    filters.query = trimmedQuery;
  }

  switch (params.view) {
    case 'upcoming': {
      filters.sort = 'asc';
      filters.sortBy = 'start_at';
      filters.statuses = [...UPCOMING_STATUSES];
      filters.from = scopeFrom ? maxIso(nowIso, scopeFrom) : nowIso;
      if (scopeTo) {
        filters.to = scopeTo;
      }
      break;
    }
    case 'past': {
      filters.sort = 'desc';
      filters.sortBy = 'start_at';
      if (scopeFrom) {
        filters.from = scopeFrom;
      }
      filters.to = scopeTo ? minIso(nowIso, scopeTo) : nowIso;
      break;
    }
    case 'recent': {
      filters.sort = 'desc';
      filters.sortBy = 'created_at';
      if (scopeFrom) {
        filters.from = scopeFrom;
      }
      if (scopeTo) {
        filters.to = scopeTo;
      }
      break;
    }
    case 'cancelled': {
      filters.sort = 'desc';
      filters.sortBy = 'start_at';
      filters.status = 'cancelled';
      if (scopeFrom) {
        filters.from = scopeFrom;
      }
      if (scopeTo) {
        filters.to = scopeTo;
      }
      break;
    }
    case 'all':
    default: {
      filters.sort = 'asc';
      filters.sortBy = 'start_at';
      if (scopeFrom && scopeTo) {
        filters.from = scopeFrom;
        filters.to = scopeTo;
      } else {
        // "All" means "all future bookings (any status)" when no scope is active.
        filters.from = nowIso;
      }
      break;
    }
  }

  // Advanced multi-status filter takes precedence over view-level status filtering.
  if (params.selectedStatuses.length > 0) {
    filters.statuses = params.selectedStatuses;
    delete filters.status;
  }

  return filters;
}

