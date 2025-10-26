import { fetchJson } from '@/lib/http/fetchJson';

import type { HttpError } from '@/lib/http/errors';
import type {
  OpsBookingHeatmap,
  OpsBookingListItem,
  OpsBookingsFilters,
  OpsBookingsPage,
  OpsBookingStatus,
  OpsServiceError,
  OpsTodayBooking,
  OpsTodayBookingsSummary,
  OpsWalkInBookingPayload,
} from '@/types/ops';

const OPS_BOOKINGS_BASE = '/api/ops/bookings';
const OPS_DASHBOARD_BASE = '/api/ops/dashboard';

type SummaryParams = {
  restaurantId: string;
  date?: string | null;
};

type HeatmapParams = {
  restaurantId: string;
  startDate: string;
  endDate: string;
};

type UpdateBookingInput = {
  id: string;
  startIso: string;
  endIso: string;
  partySize: number;
  notes?: string | null;
  override?: {
    apply: boolean;
    reason?: string | null;
  } | null;
};

type UpdateStatusInput = {
  id: string;
  status: 'completed' | 'no_show';
};

type LifecycleInput = {
  id: string;
  performedAt?: string;
};

type NoShowInput = {
  id: string;
  performedAt?: string;
  reason?: string | null;
};

type UndoNoShowInput = {
  id: string;
  reason?: string | null;
};

type LifecycleResponse = {
  status: OpsBookingStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

type StatusSummaryParams = {
  restaurantId: string;
  from?: string | null;
  to?: string | null;
  statuses?: OpsBookingStatus[] | null;
};

type StatusSummaryResponse = {
  restaurantId: string;
  range: {
    from: string | null;
    to: string | null;
  };
  filter: {
    statuses: OpsBookingStatus[] | null;
  };
  totals: Record<OpsBookingStatus, number>;
  generatedAt: string;
};

type BookingHistoryEntry = {
  id: number;
  bookingId: string;
  fromStatus: OpsBookingStatus | null;
  toStatus: OpsBookingStatus;
  changedAt: string;
  changedBy: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type BookingHistoryResponse = {
  bookingId: string;
  entries: BookingHistoryEntry[];
  generatedAt: string;
};

type CancelBookingInput = {
  id: string;
};

type WalkInInput = OpsWalkInBookingPayload & {
  idempotencyKey?: string;
};

type WalkInResponse = {
  booking: unknown;
  bookings: unknown;
  idempotencyKey: string | null;
  clientRequestId: string;
};

type AssignTableInput = {
  bookingId: string;
  tableId: string;
};

type AutoAssignTablesInput = {
  restaurantId: string;
  date?: string | null;
};

type TableAssignmentsResponse = {
  tableAssignments: OpsTodayBooking['tableAssignments'];
};

type AutoAssignTablesResponse = {
  date: string;
  assigned: { bookingId: string; tableIds: string[] }[];
  skipped: { bookingId: string; reason: string }[];
};

export interface BookingService {
  getTodaySummary(params: SummaryParams): Promise<OpsTodayBookingsSummary>;
  getBookingHeatmap(params: HeatmapParams): Promise<OpsBookingHeatmap>;
  listBookings(filters: OpsBookingsFilters): Promise<OpsBookingsPage>;
  updateBooking(input: UpdateBookingInput): Promise<OpsBookingListItem>;
  updateBookingStatus(input: UpdateStatusInput): Promise<{ status: OpsBookingStatus }>;
  checkInBooking(input: LifecycleInput): Promise<LifecycleResponse>;
  checkOutBooking(input: LifecycleInput): Promise<LifecycleResponse>;
  markNoShowBooking(input: NoShowInput): Promise<LifecycleResponse>;
  undoNoShowBooking(input: UndoNoShowInput): Promise<LifecycleResponse>;
  getStatusSummary(params: StatusSummaryParams): Promise<StatusSummaryResponse>;
  getBookingHistory(bookingId: string): Promise<BookingHistoryResponse>;
  cancelBooking(input: CancelBookingInput): Promise<{ id: string; status: string }>;
  createWalkInBooking(input: WalkInInput): Promise<WalkInResponse>;
  assignTable(input: AssignTableInput): Promise<TableAssignmentsResponse>;
  unassignTable(input: AssignTableInput): Promise<TableAssignmentsResponse>;
  autoAssignTables(input: AutoAssignTablesInput): Promise<AutoAssignTablesResponse>;
}

function toIsoParam(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function buildSearch(filters: OpsBookingsFilters): string {
  const params = new URLSearchParams();

  params.set('restaurantId', filters.restaurantId);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.statuses && filters.statuses.length > 0) params.set('statuses', filters.statuses.join(','));
  if (filters.sort) params.set('sort', filters.sort);
  const fromIso = toIsoParam(filters.from ?? undefined);
  if (fromIso) params.set('from', fromIso);
  const toIso = toIsoParam(filters.to ?? undefined);
  if (toIso) params.set('to', toIso);
  const query = filters.query?.toString().trim();
  if (query) params.set('query', query);

  return params.toString();
}

function buildStatusSummarySearch(params: StatusSummaryParams): string {
  const search = new URLSearchParams({ restaurantId: params.restaurantId });
  if (params.from) {
    search.set('from', params.from);
  }
  if (params.to) {
    search.set('to', params.to);
  }
  if (params.statuses && params.statuses.length > 0) {
    search.set('statuses', params.statuses.join(','));
  }
  return search.toString();
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBrowserBookingService(): BookingService {
  return {
    async getTodaySummary({ restaurantId, date }) {
      const params = new URLSearchParams({ restaurantId });
      if (date) params.set('date', date);
      return fetchJson<OpsTodayBookingsSummary>(`${OPS_DASHBOARD_BASE}/summary?${params.toString()}`);
    },
    async getBookingHeatmap({ restaurantId, startDate, endDate }) {
      const params = new URLSearchParams({ restaurantId, startDate, endDate });
      return fetchJson<OpsBookingHeatmap>(`${OPS_DASHBOARD_BASE}/heatmap?${params.toString()}`);
    },
    async getStatusSummary(params) {
      const query = buildStatusSummarySearch(params);
      return fetchJson<StatusSummaryResponse>(`${OPS_BOOKINGS_BASE}/status-summary?${query}`);
    },
    async listBookings(filters) {
      const search = buildSearch(filters);
      return fetchJson<OpsBookingsPage>(`${OPS_BOOKINGS_BASE}?${search}`);
    },
    async updateBooking({ id, ...body }) {
      return fetchJson<OpsBookingListItem>(`${OPS_BOOKINGS_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    async updateBookingStatus({ id, status }) {
      return fetchJson<{ status: OpsBookingStatus }>(`${OPS_BOOKINGS_BASE}/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    },
    async checkInBooking({ id, performedAt }) {
      const body = performedAt ? { performedAt } : undefined;
      return fetchJson<LifecycleResponse>(`${OPS_BOOKINGS_BASE}/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    async checkOutBooking({ id, performedAt }) {
      const body = performedAt ? { performedAt } : undefined;
      return fetchJson<LifecycleResponse>(`${OPS_BOOKINGS_BASE}/${id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    async markNoShowBooking({ id, performedAt, reason }) {
      const payload: Record<string, unknown> = {};
      if (performedAt) payload.performedAt = performedAt;
      if (reason) payload.reason = reason;
      return fetchJson<LifecycleResponse>(`${OPS_BOOKINGS_BASE}/${id}/no-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
      });
    },
    async undoNoShowBooking({ id, reason }) {
      const payload: Record<string, unknown> = {};
      if (reason) payload.reason = reason;
      return fetchJson<LifecycleResponse>(`${OPS_BOOKINGS_BASE}/${id}/undo-no-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
      });
    },
    async getBookingHistory(bookingId) {
      return fetchJson<BookingHistoryResponse>(`${OPS_BOOKINGS_BASE}/${bookingId}/history`);
    },
    async cancelBooking({ id }) {
      return fetchJson<{ id: string; status: string }>(`${OPS_BOOKINGS_BASE}/${id}`, {
        method: 'DELETE',
      });
    },
    async createWalkInBooking(input) {
      const { idempotencyKey, ...payload } = input;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }
      return fetchJson<WalkInResponse>(OPS_BOOKINGS_BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    },
    async assignTable({ bookingId, tableId }) {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Idempotency-Key': createIdempotencyKey(),
      };

      return fetchJson<TableAssignmentsResponse>(`${OPS_BOOKINGS_BASE}/${bookingId}/tables`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tableId }),
      });
    },
    async unassignTable({ bookingId, tableId }) {
      return fetchJson<TableAssignmentsResponse>(`${OPS_BOOKINGS_BASE}/${bookingId}/tables/${tableId}`, {
        method: 'DELETE',
      });
    },
    async autoAssignTables({ restaurantId, date }) {
      const payload: Record<string, unknown> = { restaurantId };
      if (date) {
        payload.date = date;
      }

      return fetchJson<AutoAssignTablesResponse>(`${OPS_DASHBOARD_BASE}/assign-tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
  } satisfies BookingService;
}

export class NotImplementedBookingService implements BookingService {
  private error(message: string): never {
    throw new Error(`[ops][bookingService] ${message}`);
  }

  getTodaySummary(): Promise<OpsTodayBookingsSummary> {
    this.error('getTodaySummary not implemented');
  }

  getBookingHeatmap(): Promise<OpsBookingHeatmap> {
    this.error('getBookingHeatmap not implemented');
  }

  listBookings(): Promise<OpsBookingsPage> {
    this.error('listBookings not implemented');
  }

  updateBooking(): Promise<OpsBookingListItem> {
    this.error('updateBooking not implemented');
  }

  updateBookingStatus(): Promise<{ status: OpsBookingStatus }> {
    this.error('updateBookingStatus not implemented');
  }

  checkInBooking(): Promise<LifecycleResponse> {
    this.error('checkInBooking not implemented');
  }

  checkOutBooking(): Promise<LifecycleResponse> {
    this.error('checkOutBooking not implemented');
  }

  markNoShowBooking(): Promise<LifecycleResponse> {
    this.error('markNoShowBooking not implemented');
  }

  undoNoShowBooking(): Promise<LifecycleResponse> {
    this.error('undoNoShowBooking not implemented');
  }

  getStatusSummary(): Promise<StatusSummaryResponse> {
    this.error('getStatusSummary not implemented');
  }

  getBookingHistory(): Promise<BookingHistoryResponse> {
    this.error('getBookingHistory not implemented');
  }

  cancelBooking(): Promise<{ id: string; status: string }> {
    this.error('cancelBooking not implemented');
  }

  createWalkInBooking(): Promise<WalkInResponse> {
    this.error('createWalkInBooking not implemented');
  }

  assignTable(): Promise<TableAssignmentsResponse> {
    this.error('assignTable not implemented');
  }

  unassignTable(): Promise<TableAssignmentsResponse> {
    this.error('unassignTable not implemented');
  }

  autoAssignTables(): Promise<AutoAssignTablesResponse> {
    this.error('autoAssignTables not implemented');
  }
}

export type BookingServiceFactory = () => BookingService;

export function createBookingService(factory?: BookingServiceFactory): BookingService {
  try {
    return factory ? factory() : createBrowserBookingService();
  } catch (error) {
    const fallback = new NotImplementedBookingService();
    if (error instanceof Error) {
      console.error('[ops][bookingService] failed to create service', error.message);
    }
    return fallback;
  }
}

export type BookingServiceError = OpsServiceError | HttpError;
