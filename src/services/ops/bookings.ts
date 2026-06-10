import { HttpError, normalizeError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';

import type {
  BookingEmailDeliveryResponse,
  EmailDeliveryStatus,
  OpsEmailDeliveryFeedResponse,
  OpsEmailDeliveryRange,
  OpsEmailDeliverySummaryResponse,
} from '@/types/emailDelivery';
import type { OpsEmailQueueFeedResponse, OpsEmailQueueJobStatus } from '@/types/emailQueue';
import type {
  OpsBookingHeatmap,
  OpsBookingListItem,
  OpsBookingsFilters,
  OpsBookingsPage,
  OpsBookingStatus,
  OpsServiceError,
  OpsStrategicSettings,
  OpsTodayBooking,
  OpsTodayBookingsSummary,
  OpsWalkInBookingPayload,
} from '@/types/ops';
import type {
  BookingSmsDeliveryResponse,
  OpsSmsDeliveryFeedResponse,
  OpsSmsDeliveryRange,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';
import type { Tables } from '@/types/supabase';

const OPS_BOOKINGS_BASE = '/api/ops/bookings';
const OPS_DASHBOARD_BASE = '/api/ops/dashboard';
const OPS_SETTINGS_BASE = '/api/ops/settings';
const STAFF_AUTO_BASE = '/api/staff/auto';

type SummaryParams = {
  restaurantId: string;
  date?: string | null;
};

type HeatmapParams = {
  restaurantId: string;
  startDate: string;
  endDate: string;
};

type StrategicSettingsParams = {
  restaurantId: string;
};

type StrategicSettingsUpdate = {
  restaurantId: string;
  weights: {
    scarcity: number;
    demandMultiplier?: number | null;
    futureConflictPenalty?: number | null;
  };
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

type TableAssignmentsResponse = {
  tableAssignments: OpsTodayBooking['tableAssignments'];
};

type AutoQuoteCandidate = {
  tableIds: string[];
  tableNumbers: string[];
  totalCapacity: number;
  tableCount: number;
  slack?: number;
  score?: number;
  adjacencyStatus?: 'single' | 'connected' | 'neighbors' | 'pairwise' | 'disconnected';
};

type AutoQuoteResponse = {
  holdId: string | null;
  expiresAt: string | null;
  window: { start: string | null; end: string | null } | null;
  candidate: AutoQuoteCandidate | null;
  alternates: AutoQuoteCandidate[];
  nextTimes: string[];
  reason?: string | null;
  zoneId?: string | null;
  requireAdjacency?: boolean | null;
  serviceFallback?: {
    usedFallback: boolean;
    fallbackService: string | null;
  };
};

type AutoQuoteInput = {
  bookingId: string;
  zoneId?: string;
  maxTables?: number;
  requireAdjacency?: boolean;
  avoidTables?: string[];
  holdTtlSeconds?: number;
};

type ConfirmHoldInput = {
  holdId: string;
  bookingId: string;
  idempotencyKey: string;
  requireAdjacency?: boolean;
  contextVersion?: string;
  selectionVersion?: number | null;
};

export type ConfirmHoldAssignment = {
  tableId: string;
  assignmentId?: string;
  startAt?: string | null;
  endAt?: string | null;
  mergeGroupId?: string | null;
};

type ConfirmHoldResponse = {
  holdId: string;
  bookingId: string;
  assignments: ConfirmHoldAssignment[];
};

export type ManualSelectionCheckStatus = 'ok' | 'warn' | 'error';
export type ManualSelectionCheckId = 'sameZone' | 'movable' | 'adjacency' | 'conflict' | 'capacity';

export type ManualSelectionCheck = {
  id: ManualSelectionCheckId;
  status: ManualSelectionCheckStatus;
  message: string;
  details?: Record<string, unknown>;
};

export type ManualSelectionSummary = {
  tableCount: number;
  totalCapacity: number;
  slack: number;
  zoneId: string | null;
  tableNumbers: string[];
  partySize: number;
};

export type ManualValidationResult = {
  ok: boolean;
  checks: ManualSelectionCheck[];
  summary: ManualSelectionSummary;
  policyVersion?: string;
};

export type ManualHoldSummary = {
  id: string;
  expiresAt: string;
  startAt: string;
  endAt: string;
  zoneId: string;
  tableIds: string[];
};

export type ManualHoldResponse = {
  hold: ManualHoldSummary | null;
  validation: ManualValidationResult;
  summary: ManualSelectionSummary;
};

export type ManualSelectionPayload = {
  bookingId: string;
  tableIds: string[];
  requireAdjacency?: boolean;
  excludeHoldId?: string;
  contextVersion?: string;
  selectionVersion?: number | null;
};

export type ManualHoldPayload = ManualSelectionPayload & {
  holdTtlSeconds?: number;
};

export type ManualAssignmentTable = {
  id: string;
  tableNumber: string;
  name?: string | null; // Optional table name (e.g., "Patio Corner", "Window Seat")
  capacity: number;
  minPartySize: number;
  maxPartySize: number | null;
  section: string | null;
  category: string;
  seatingType: string;
  mobility: string;
  zoneId: string;
  zoneActive?: boolean | null;
  status: string;
  active: boolean;
  position: Record<string, unknown> | null;
};

export type ManualAssignmentContextHold = {
  id: string;
  bookingId: string | null;
  restaurantId: string;
  zoneId: string;
  startAt: string;
  endAt: string;
  expiresAt: string;
  tableIds: string[];
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  metadata: Record<string, unknown> | null;
  countdownSeconds: number | null;
};

export type ManualAssignmentConflict = {
  tableId: string;
  bookingId: string;
  startAt: string;
  endAt: string;
  status: OpsBookingStatus | Tables<'bookings'>['status'];
};

export type ManualAssignmentContext = {
  booking: {
    id: string;
    restaurantId: string;
    bookingDate: string | null;
    startAt: string | null;
    endAt: string | null;
    partySize: number;
    status: OpsBookingStatus | Tables<'bookings'>['status'];
  };
  tables: ManualAssignmentTable[];
  bookingAssignments: string[];
  holds: ManualAssignmentContextHold[];
  activeHold: ManualAssignmentContextHold | null;
  conflicts: ManualAssignmentConflict[];
  window: {
    startAt: string | null;
    endAt: string | null;
  };
  policyVersion?: string | null;
  versions?: {
    context?: string | null;
    policy?: string | null;
    window?: string | null;
    flags?: string | null;
    tables?: string | null;
    adjacency?: string | null;
    holds?: string | null;
    assignments?: string | null;
  };
  contextVersion?: string;
  serverNow?: string | null;
};

export type ManualReleaseHoldPayload = {
  holdId: string;
  bookingId: string;
};

export type ManualAssignmentSession = {
  id: string;
  bookingId: string;
  restaurantId: string;
  state: 'none' | 'proposed' | 'held' | 'confirmed' | 'expired' | 'conflicted' | 'cancelled';
  selection?: {
    tableIds: string[];
    requireAdjacency?: boolean | null;
    summary?: ManualValidationResult['summary'] | null;
  } | null;
  selectionVersion: number;
  contextVersion?: string | null;
  policyVersion?: string | null;
  snapshotHash?: string | null;
  holdId?: string | null;
  expiresAt?: string | null;
  tableVersion?: string | null;
  adjacencyVersion?: string | null;
  flagsVersion?: string | null;
  windowVersion?: string | null;
  holdsVersion?: string | null;
  assignmentsVersion?: string | null;
};

export type ManualAssignmentContextWithSession = ManualAssignmentContext & {
  session?: ManualAssignmentSession | null;
};

// Simplified context for the direct assignment UI
/**
 * Consolidated dialog payload returned by GET /api/ops/bookings/:id/dialog.
 * Used by `useOpsBookingDialogBundle` to seed both the booking-detail and
 * assignment-context React Query caches in a single round-trip.
 */
export type OpsBookingDialogBundle = {
  booking: OpsBookingListItem;
  assignmentContext: AssignmentContext;
};

export type AssignmentContext = {
  booking: {
    id: string;
    restaurant_id: string | null;
    start_at: string | null;
    booking_date: string | null;
    start_time: string | null;
    party_size: number;
    status: OpsBookingStatus | Tables<'bookings'>['status'];
  };
  timezone: string | null;
  tables: ManualAssignmentTable[];
  bookingAssignments: string[];
  conflicts: ManualAssignmentConflict[];
  window: { startAt: string; endAt: string };
  serverNow: string;
  holds?: ManualAssignmentContextHold[];
};

export type DisabledAssignmentEntry = {
  tableId: string;
  tableNumber: string | null;
  tableStatus: string | null;
  tableActive: boolean | null;
  zoneId: string | null;
  zoneName: string | null;
  zoneActive: boolean | null;
  startAt: string | null;
  endAt: string | null;
};

export type DisabledAssignmentsResponse = {
  restaurantId: string;
  disabledTableCount: number;
  bookings: Array<{
    id: string;
    status: string | null;
    partySize: number | null;
    startIso: string | null;
    endIso: string | null;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    assignments: DisabledAssignmentEntry[];
  }>;
};

export interface BookingService {
  getTodaySummary(params: SummaryParams): Promise<OpsTodayBookingsSummary>;
  getBookingHeatmap(params: HeatmapParams): Promise<OpsBookingHeatmap>;
  getStrategicSettings(params: StrategicSettingsParams): Promise<OpsStrategicSettings>;
  updateStrategicSettings(input: StrategicSettingsUpdate): Promise<OpsStrategicSettings>;
  listBookings(filters: OpsBookingsFilters): Promise<OpsBookingsPage>;
  listDisabledAssignments(params: { restaurantId: string }): Promise<DisabledAssignmentsResponse>;
  updateBooking(input: UpdateBookingInput): Promise<OpsBookingListItem>;
  checkInBooking(input: LifecycleInput): Promise<LifecycleResponse>;
  checkOutBooking(input: LifecycleInput): Promise<LifecycleResponse>;
  markNoShowBooking(input: NoShowInput): Promise<LifecycleResponse>;
  undoNoShowBooking(input: UndoNoShowInput): Promise<LifecycleResponse>;
  getStatusSummary(params: StatusSummaryParams): Promise<StatusSummaryResponse>;
  getBookingHistory(bookingId: string): Promise<BookingHistoryResponse>;
  getBooking(bookingId: string): Promise<OpsBookingListItem>;
  getBookingEmailDeliveryLog(
    bookingId: string,
    params?: { limit?: number },
  ): Promise<BookingEmailDeliveryResponse>;
  getBookingSmsDeliveryLog(
    bookingId: string,
    params?: { limit?: number },
  ): Promise<BookingSmsDeliveryResponse>;
  getRestaurantSmsDeliveryFeed(params: {
    restaurantId?: string;
    range?: OpsSmsDeliveryRange;
    page?: number;
    pageSize?: number;
    status?: SmsDeliveryStatus[];
  }): Promise<OpsSmsDeliveryFeedResponse>;
  getRestaurantEmailDeliveryFeed(params: {
    restaurantId?: string;
    range?: OpsEmailDeliveryRange;
    page?: number;
    pageSize?: number;
    status?: EmailDeliveryStatus[];
    simulateEmailDeliveryError?: boolean;
    fixture?: string;
    recipientEmail?: string;
    messageId?: string;
    bookingRef?: string;
    templateType?: string;
    emailType?: string;
  }): Promise<OpsEmailDeliveryFeedResponse>;
  getRestaurantEmailDeliverySummary(params: {
    restaurantId?: string;
    range?: OpsEmailDeliveryRange;
    simulateEmailDeliveryError?: boolean;
    recipientEmail?: string;
    messageId?: string;
    bookingRef?: string;
    templateType?: string;
    emailType?: string;
  }): Promise<OpsEmailDeliverySummaryResponse>;
  getRestaurantEmailQueue(params: {
    restaurantId?: string;
    page?: number;
    pageSize?: number;
    status?: OpsEmailQueueJobStatus;
    fixture?: string;
  }): Promise<OpsEmailQueueFeedResponse>;
  retryEmailDelivery(input: { deliveryLogId: string; simulateError?: boolean }): Promise<{
    ok: true;
    deliveryLogEntry: unknown;
  }>;
  cancelBooking(input: CancelBookingInput): Promise<{ id: string; status: string }>;
  createWalkInBooking(input: WalkInInput): Promise<WalkInResponse>;
  assignTable(input: AssignTableInput): Promise<TableAssignmentsResponse>;
  unassignTable(input: AssignTableInput): Promise<TableAssignmentsResponse>;
  autoQuoteTables(input: AutoQuoteInput): Promise<AutoQuoteResponse>;
  confirmHoldAssignment(input: ConfirmHoldInput): Promise<ConfirmHoldResponse>;
  getManualAssignmentContext(
    bookingId: string,
    options?: { preferSession?: boolean },
  ): Promise<ManualAssignmentContextWithSession>;
  getAssignmentContext(bookingId: string): Promise<AssignmentContext>;
  /**
   * Consolidated dialog payload: returns the booking detail and the
   * assignment-context in a single round-trip from the
   * `GET /api/ops/bookings/:id/dialog` endpoint.
   */
  getDialogBundle(bookingId: string): Promise<OpsBookingDialogBundle>;
  assignTablesDirect(input: {
    bookingId: string;
    tableIds: string[];
    idempotencyKey: string;
    requireAdjacency?: boolean;
  }): Promise<{
    success: true;
    assignments: Array<{
      id: string;
      booking_id: string;
      table_id: string;
      assigned_at: string;
      assigned_by: string | null;
    }>;
    booking: {
      id: string;
      status: string;
      party_size: number;
    };
    summary: {
      tableCount: number;
      totalCapacity: number;
      partySize: number;
      slack: number;
    };
  }>;
  unassignTablesDirect(input: {
    bookingId: string;
    tableIds: string[];
  }): Promise<{ success: true; removedCount: number }>;
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
  if (filters.tableId) params.set('tableId', filters.tableId);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.statuses && filters.statuses.length > 0)
    params.set('statuses', filters.statuses.join(','));
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.countStrategy) params.set('countStrategy', filters.countStrategy);
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

async function fetchContextVersion(bookingId: string): Promise<string | null> {
  try {
    const res = await fetchJson<ManualAssignmentContext>(
      `/api/ops/bookings/${bookingId}/manual-context`,
    );
    return res?.contextVersion ?? null;
  } catch {
    return null;
  }
}

export function createBrowserBookingService(): BookingService {
  return {
    async getTodaySummary({ restaurantId, date }) {
      const params = new URLSearchParams({ restaurantId });
      if (date) params.set('date', date);
      return fetchJson<OpsTodayBookingsSummary>(
        `${OPS_DASHBOARD_BASE}/summary?${params.toString()}`,
      );
    },
    async getBookingHeatmap({ restaurantId, startDate, endDate }) {
      const params = new URLSearchParams({ restaurantId, startDate, endDate });
      return fetchJson<OpsBookingHeatmap>(`${OPS_DASHBOARD_BASE}/heatmap?${params.toString()}`);
    },
    async getStrategicSettings({ restaurantId }) {
      const params = new URLSearchParams({ restaurantId });
      return fetchJson<OpsStrategicSettings>(
        `${OPS_SETTINGS_BASE}/strategic-config?${params.toString()}`,
      );
    },
    async updateStrategicSettings({ restaurantId: _restaurantId, weights: _weights }) {
      console.warn(
        '[bookingService] Strategic settings are read-only; update env values and redeploy.',
      );
      return Promise.reject(
        new Error('Strategic settings are read-only; update env values and redeploy.'),
      );
    },
    async getStatusSummary(params) {
      const query = buildStatusSummarySearch(params);
      return fetchJson<StatusSummaryResponse>(`${OPS_BOOKINGS_BASE}/status-summary?${query}`);
    },
    async listBookings(filters) {
      const search = buildSearch(filters);
      return fetchJson<OpsBookingsPage>(`${OPS_BOOKINGS_BASE}?${search}`);
    },
    async listDisabledAssignments({ restaurantId }) {
      const params = new URLSearchParams({ restaurantId });
      return fetchJson<DisabledAssignmentsResponse>(
        `${OPS_BOOKINGS_BASE}/disabled?${params.toString()}`,
      );
    },
    async updateBooking({ id, ...body }) {
      return fetchJson<OpsBookingListItem>(`${OPS_BOOKINGS_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    async getBooking(bookingId) {
      return fetchJson<OpsBookingListItem>(`${OPS_BOOKINGS_BASE}/${bookingId}`);
    },
    async getBookingEmailDeliveryLog(bookingId, params) {
      const rawLimit = params?.limit;
      const fallback = 50;
      const limit =
        typeof rawLimit === 'number' && Number.isFinite(rawLimit) ? Math.floor(rawLimit) : fallback;
      const clamped = Math.max(1, Math.min(200, limit));

      const search = new URLSearchParams({ limit: String(clamped) });
      const url = `${OPS_BOOKINGS_BASE}/${bookingId}/email-delivery?${search.toString()}`;

      try {
        return await fetchJson<BookingEmailDeliveryResponse>(url);
      } catch (error) {
        if (error instanceof HttpError) {
          const code =
            error.status === 401 || error.status === 419
              ? 'UNAUTHENTICATED'
              : error.status === 403
                ? 'FORBIDDEN'
                : error.status === 404
                  ? 'BOOKING_NOT_FOUND'
                  : error.status === 503
                    ? 'DELIVERY_LOG_UNAVAILABLE'
                    : 'INTERNAL';
          return { ok: false, code, error: error.message, message: error.message };
        }
        throw error;
      }
    },
    async getBookingSmsDeliveryLog(bookingId, params) {
      const rawLimit = params?.limit;
      const fallback = 50;
      const limit =
        typeof rawLimit === 'number' && Number.isFinite(rawLimit) ? Math.floor(rawLimit) : fallback;
      const clamped = Math.max(1, Math.min(200, limit));

      const search = new URLSearchParams({ limit: String(clamped) });
      const url = `${OPS_BOOKINGS_BASE}/${bookingId}/sms-delivery?${search.toString()}`;

      try {
        return await fetchJson<BookingSmsDeliveryResponse>(url);
      } catch (error) {
        if (error instanceof HttpError) {
          const code =
            error.status === 401 || error.status === 419
              ? 'UNAUTHENTICATED'
              : error.status === 403
                ? 'FORBIDDEN'
                : error.status === 404
                  ? 'BOOKING_NOT_FOUND'
                  : error.status === 503
                    ? 'DELIVERY_LOG_UNAVAILABLE'
                    : 'INTERNAL';
          return { ok: false, code, error: error.message, message: error.message };
        }
        throw error;
      }
    },
    async getRestaurantSmsDeliveryFeed(params) {
      const rawPage =
        typeof params.page === 'number' && Number.isFinite(params.page) ? params.page : 1;
      const rawPageSize =
        typeof params.pageSize === 'number' && Number.isFinite(params.pageSize)
          ? params.pageSize
          : 50;
      const page = Math.max(1, Math.floor(rawPage));
      const pageSize = Math.max(1, Math.min(200, Math.floor(rawPageSize)));
      const range: OpsSmsDeliveryRange = params.range ?? '7d';

      const search = new URLSearchParams();
      if (params.restaurantId) search.set('restaurantId', params.restaurantId);
      search.set('range', range);
      search.set('page', String(page));
      search.set('pageSize', String(pageSize));
      if (params.status && params.status.length > 0) {
        search.set('status', params.status.join(','));
      }

      const url = `/api/ops/sms-delivery?${search.toString()}`;
      try {
        return await fetchJson<OpsSmsDeliveryFeedResponse>(url);
      } catch (error) {
        if (error instanceof HttpError) {
          const code =
            error.status === 401 || error.status === 419
              ? 'UNAUTHENTICATED'
              : error.status === 403
                ? 'FORBIDDEN'
                : error.status === 503
                  ? 'DELIVERY_LOG_UNAVAILABLE'
                  : 'INTERNAL';
          return { ok: false, code, error: error.message, message: error.message };
        }
        throw error;
      }
    },
    async getRestaurantEmailDeliveryFeed(params) {
      const rawPage =
        typeof params.page === 'number' && Number.isFinite(params.page) ? params.page : 1;
      const rawPageSize =
        typeof params.pageSize === 'number' && Number.isFinite(params.pageSize)
          ? params.pageSize
          : 50;

      const page = Math.max(1, Math.floor(rawPage));
      const pageSize = Math.max(1, Math.min(200, Math.floor(rawPageSize)));
      const range: OpsEmailDeliveryRange = params.range ?? '7d';

      const search = new URLSearchParams();
      if (params.restaurantId) search.set('restaurantId', params.restaurantId);
      search.set('range', range);
      search.set('page', String(page));
      search.set('pageSize', String(pageSize));

      if (params.status && params.status.length > 0) {
        search.set('status', params.status.join(','));
      }
      if (params.simulateEmailDeliveryError) search.set('simulateEmailDeliveryError', '1');
      if (params.fixture) search.set('fixture', params.fixture.trim());
      if (params.recipientEmail) search.set('recipientEmail', params.recipientEmail.trim());
      if (params.messageId) search.set('messageId', params.messageId.trim());
      if (params.bookingRef) search.set('bookingRef', params.bookingRef.trim().toUpperCase());
      if (params.templateType) search.set('templateType', params.templateType.trim());
      if (params.emailType) search.set('emailType', params.emailType.trim());

      const url = `/api/ops/email-delivery?${search.toString()}`;

      try {
        return await fetchJson<OpsEmailDeliveryFeedResponse>(url);
      } catch (error) {
        if (error instanceof HttpError) {
          const code =
            error.status === 401 || error.status === 419
              ? 'UNAUTHENTICATED'
              : error.status === 403
                ? 'FORBIDDEN'
                : error.status === 418
                  ? 'FORCED_ERROR'
                  : error.status === 503
                    ? 'DELIVERY_LOG_UNAVAILABLE'
                    : 'INTERNAL';
          return { ok: false, code, error: error.message, message: error.message };
        }
        throw error;
      }
    },
    async getRestaurantEmailDeliverySummary(params) {
      const range: OpsEmailDeliveryRange = params.range ?? '7d';

      const search = new URLSearchParams();
      if (params.restaurantId) search.set('restaurantId', params.restaurantId);
      search.set('range', range);
      search.set('page', '1');
      search.set('pageSize', '1');
      search.set('summaryOnly', '1');

      if (params.simulateEmailDeliveryError) search.set('simulateEmailDeliveryError', '1');
      if (params.recipientEmail) search.set('recipientEmail', params.recipientEmail.trim());
      if (params.messageId) search.set('messageId', params.messageId.trim());
      if (params.bookingRef) search.set('bookingRef', params.bookingRef.trim().toUpperCase());
      if (params.templateType) search.set('templateType', params.templateType.trim());
      if (params.emailType) search.set('emailType', params.emailType.trim());

      const url = `/api/ops/email-delivery?${search.toString()}`;

      try {
        return await fetchJson<OpsEmailDeliverySummaryResponse>(url);
      } catch (error) {
        if (error instanceof HttpError) {
          const code =
            error.status === 401 || error.status === 419
              ? 'UNAUTHENTICATED'
              : error.status === 403
                ? 'FORBIDDEN'
                : error.status === 418
                  ? 'FORCED_ERROR'
                  : error.status === 503
                    ? 'DELIVERY_LOG_UNAVAILABLE'
                    : 'INTERNAL';
          return { ok: false, code, error: error.message, message: error.message };
        }
        throw error;
      }
    },
    async retryEmailDelivery({ deliveryLogId, simulateError }) {
      try {
        const response = await fetch('/api/ops/email-delivery/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deliveryLogId,
            ...(simulateError ? { simulateError: true } : {}),
          }),
          credentials: 'include',
        });

        const text = await response.text();
        const parsed = text ? (JSON.parse(text) as unknown) : undefined;

        if (!response.ok) {
          const errorBody =
            typeof parsed === 'object' && parsed !== null
              ? (parsed as Record<string, unknown>)
              : undefined;
          throw normalizeError({
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
          });
        }

        return (
          (parsed as { ok: true; deliveryLogEntry: unknown }) ?? {
            ok: true,
            deliveryLogEntry: null,
          }
        );
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError({
          message: error instanceof Error ? error.message : 'Failed to retry email delivery',
          status: 500,
          code: 'INTERNAL',
          cause: error,
        });
      }
    },
    async getRestaurantEmailQueue(params) {
      const rawPage =
        typeof params.page === 'number' && Number.isFinite(params.page) ? params.page : 1;
      const rawPageSize =
        typeof params.pageSize === 'number' && Number.isFinite(params.pageSize)
          ? params.pageSize
          : 25;

      const page = Math.max(1, Math.floor(rawPage));
      const pageSize = Math.max(1, Math.min(100, Math.floor(rawPageSize)));
      const search = new URLSearchParams();
      if (params.restaurantId) search.set('restaurantId', params.restaurantId);
      search.set('page', String(page));
      search.set('pageSize', String(pageSize));
      if (params.status) search.set('status', params.status);
      if (params.fixture) search.set('fixture', params.fixture.trim());

      try {
        return await fetchJson<OpsEmailQueueFeedResponse>(
          `/api/ops/email-queue?${search.toString()}`,
        );
      } catch (error) {
        if (error instanceof HttpError) {
          const code =
            error.status === 401 || error.status === 419
              ? 'UNAUTHENTICATED'
              : error.status === 403
                ? 'FORBIDDEN'
                : 'INTERNAL';
          return { ok: false, code, error: error.message, message: error.message };
        }
        throw error;
      }
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
      return fetchJson<TableAssignmentsResponse>(
        `${OPS_BOOKINGS_BASE}/${bookingId}/tables/${tableId}`,
        {
          method: 'DELETE',
        },
      );
    },
    async autoQuoteTables({
      bookingId,
      zoneId,
      maxTables,
      requireAdjacency,
      avoidTables,
      holdTtlSeconds,
    }) {
      const payload: Record<string, unknown> = { bookingId };
      if (zoneId) payload.zoneId = zoneId;
      if (typeof maxTables === 'number') payload.maxTables = maxTables;
      if (typeof requireAdjacency === 'boolean') payload.requireAdjacency = requireAdjacency;
      if (Array.isArray(avoidTables) && avoidTables.length > 0) payload.avoidTables = avoidTables;
      if (typeof holdTtlSeconds === 'number') payload.holdTtlSeconds = holdTtlSeconds;

      return fetchJson<AutoQuoteResponse>(`${STAFF_AUTO_BASE}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    async confirmHoldAssignment({
      holdId,
      bookingId,
      idempotencyKey,
      requireAdjacency,
      contextVersion,
    }) {
      if (!contextVersion) {
        contextVersion = (await fetchContextVersion(bookingId)) ?? '';
      }
      const payload: Record<string, unknown> = {
        holdId,
        bookingId,
        idempotencyKey,
        contextVersion,
      };
      if (typeof requireAdjacency === 'boolean') payload.requireAdjacency = requireAdjacency;

      return fetchJson<ConfirmHoldResponse>(`${STAFF_AUTO_BASE}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    async getManualAssignmentContext(bookingId, _options) {
      const context = await fetchJson<ManualAssignmentContext>(
        `/api/ops/bookings/${bookingId}/manual-context`,
        {
          method: 'GET',
        },
      );
      // Return context with null session (session-based approach no longer used)
      return { ...context, session: null };
    },
    async getAssignmentContext(bookingId) {
      return fetchJson<AssignmentContext>(`/api/ops/bookings/${bookingId}/assignment-context`);
    },
    async getDialogBundle(bookingId) {
      return fetchJson<OpsBookingDialogBundle>(`/api/ops/bookings/${bookingId}/dialog`);
    },
    async assignTablesDirect({ bookingId, tableIds, idempotencyKey, requireAdjacency }) {
      return fetchJson<{
        success: true;
        assignments: Array<{
          id: string;
          booking_id: string;
          table_id: string;
          assigned_at: string;
          assigned_by: string | null;
        }>;
        booking: {
          id: string;
          status: string;
          party_size: number;
        };
        summary: {
          tableCount: number;
          totalCapacity: number;
          partySize: number;
          slack: number;
        };
      }>(`/api/ops/bookings/${bookingId}/assign-tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableIds, idempotencyKey, requireAdjacency }),
      });
    },
    async unassignTablesDirect({ bookingId, tableIds }) {
      return fetchJson<{ success: true; removedCount: number }>(
        `/api/ops/bookings/${bookingId}/assign-tables`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableIds }),
        },
      );
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

  getStrategicSettings(): Promise<OpsStrategicSettings> {
    this.error('getStrategicSettings not implemented');
  }

  updateStrategicSettings(): Promise<OpsStrategicSettings> {
    this.error('updateStrategicSettings not implemented');
  }

  listBookings(): Promise<OpsBookingsPage> {
    this.error('listBookings not implemented');
  }

  updateBooking(): Promise<OpsBookingListItem> {
    this.error('updateBooking not implemented');
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

  listDisabledAssignments(): Promise<DisabledAssignmentsResponse> {
    this.error('listDisabledAssignments not implemented');
  }

  getBookingHistory(): Promise<BookingHistoryResponse> {
    this.error('getBookingHistory not implemented');
  }

  getBooking(): Promise<OpsBookingListItem> {
    this.error('getBooking not implemented');
  }

  getBookingEmailDeliveryLog(): Promise<BookingEmailDeliveryResponse> {
    this.error('getBookingEmailDeliveryLog not implemented');
  }

  getBookingSmsDeliveryLog(): Promise<BookingSmsDeliveryResponse> {
    this.error('getBookingSmsDeliveryLog not implemented');
  }

  getRestaurantSmsDeliveryFeed(): Promise<OpsSmsDeliveryFeedResponse> {
    this.error('getRestaurantSmsDeliveryFeed not implemented');
  }

  getRestaurantEmailDeliveryFeed(): Promise<OpsEmailDeliveryFeedResponse> {
    this.error('getRestaurantEmailDeliveryFeed not implemented');
  }

  getRestaurantEmailDeliverySummary(): Promise<OpsEmailDeliverySummaryResponse> {
    this.error('getRestaurantEmailDeliverySummary not implemented');
  }

  getRestaurantEmailQueue(): Promise<OpsEmailQueueFeedResponse> {
    this.error('getRestaurantEmailQueue not implemented');
  }

  retryEmailDelivery(): Promise<{ ok: true; deliveryLogEntry: unknown }> {
    this.error('retryEmailDelivery not implemented');
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

  autoQuoteTables(): Promise<AutoQuoteResponse> {
    this.error('autoQuoteTables not implemented');
  }

  confirmHoldAssignment(): Promise<ConfirmHoldResponse> {
    this.error('confirmHoldAssignment not implemented');
  }

  getManualAssignmentContext(): Promise<ManualAssignmentContextWithSession> {
    this.error('getManualAssignmentContext not implemented');
  }

  getAssignmentContext(): Promise<AssignmentContext> {
    this.error('getAssignmentContext not implemented');
  }

  getDialogBundle(): Promise<OpsBookingDialogBundle> {
    this.error('getDialogBundle not implemented');
  }

  assignTablesDirect(): Promise<{
    success: true;
    assignments: Array<{
      id: string;
      booking_id: string;
      table_id: string;
      assigned_at: string;
      assigned_by: string | null;
    }>;
    booking: {
      id: string;
      status: string;
      party_size: number;
    };
    summary: {
      tableCount: number;
      totalCapacity: number;
      partySize: number;
      slack: number;
    };
  }> {
    this.error('assignTablesDirect not implemented');
  }

  unassignTablesDirect(): Promise<{ success: true; removedCount: number }> {
    this.error('unassignTablesDirect not implemented');
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
