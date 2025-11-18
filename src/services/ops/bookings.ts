import { fetchJson } from '@/lib/http/fetchJson';

import type { HttpError } from '@/lib/http/errors';
import type {
  OpsBookingHeatmap,
  OpsBookingListItem,
  OpsBookingsFilters,
  OpsBookingsPage,
  OpsBookingStatus,
  OpsRejectionAnalytics,
  OpsServiceError,
  OpsStrategicSettings,
  OpsTodayBooking,
  OpsTodayBookingsSummary,
  OpsWalkInBookingPayload,
} from '@/types/ops';
import type { Tables } from '@/types/supabase';

const OPS_BOOKINGS_BASE = '/api/ops/bookings';
const OPS_DASHBOARD_BASE = '/api/ops/dashboard';
const OPS_SETTINGS_BASE = '/api/ops/settings';
const STAFF_AUTO_BASE = '/api/staff/auto';
const STAFF_MANUAL_BASE = '/api/staff/manual';
const STAFF_MANUAL_SESSION_BASE = '/api/staff/manual/session';

type SummaryParams = {
  restaurantId: string;
  date?: string | null;
};

type HeatmapParams = {
  restaurantId: string;
  startDate: string;
  endDate: string;
};

type RejectionAnalyticsParams = {
  restaurantId: string;
  from?: string | null;
  to?: string | null;
  bucket?: 'day' | 'hour';
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
  capacity: number;
  minPartySize: number;
  maxPartySize: number | null;
  section: string | null;
  category: string;
  seatingType: string;
  mobility: string;
  zoneId: string;
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

export interface BookingService {
  getTodaySummary(params: SummaryParams): Promise<OpsTodayBookingsSummary>;
  getBookingHeatmap(params: HeatmapParams): Promise<OpsBookingHeatmap>;
  getRejectionAnalytics(params: RejectionAnalyticsParams): Promise<OpsRejectionAnalytics>;
  getStrategicSettings(params: StrategicSettingsParams): Promise<OpsStrategicSettings>;
  updateStrategicSettings(input: StrategicSettingsUpdate): Promise<OpsStrategicSettings>;
  listBookings(filters: OpsBookingsFilters): Promise<OpsBookingsPage>;
  updateBooking(input: UpdateBookingInput): Promise<OpsBookingListItem>;
  updateBookingStatus(input: UpdateStatusInput): Promise<{ status: OpsBookingStatus }>;
  checkInBooking(input: LifecycleInput): Promise<LifecycleResponse>;
  checkOutBooking(input: LifecycleInput): Promise<LifecycleResponse>;
  markNoShowBooking(input: NoShowInput): Promise<LifecycleResponse>;
  undoNoShowBooking(input: UndoNoShowInput): Promise<LifecycleResponse>;
  getStatusSummary(params: StatusSummaryParams): Promise<StatusSummaryResponse>;
  getBookingHistory(bookingId: string): Promise<BookingHistoryResponse>;
  getBooking(bookingId: string): Promise<OpsBookingListItem>;
  cancelBooking(input: CancelBookingInput): Promise<{ id: string; status: string }>;
  createWalkInBooking(input: WalkInInput): Promise<WalkInResponse>;
  assignTable(input: AssignTableInput): Promise<TableAssignmentsResponse>;
  unassignTable(input: AssignTableInput): Promise<TableAssignmentsResponse>;
  autoQuoteTables(input: AutoQuoteInput): Promise<AutoQuoteResponse>;
  confirmHoldAssignment(input: ConfirmHoldInput): Promise<ConfirmHoldResponse>;
  manualValidateSelection(input: ManualSelectionPayload): Promise<ManualValidationResult>;
  manualHoldSelection(input: ManualHoldPayload): Promise<ManualHoldResponse>;
  manualConfirmHold(input: ConfirmHoldInput): Promise<{ session: ManualAssignmentSession | null; assignments: ConfirmHoldAssignment[]; context: ManualAssignmentContext }>;
  getManualAssignmentContext(bookingId: string, options?: { preferSession?: boolean }): Promise<ManualAssignmentContextWithSession>;
  manualEnsureSession(input: { bookingId: string }): Promise<ManualAssignmentContextWithSession>;
  manualSessionUpdateSelection(input: {
    sessionId: string;
    bookingId: string;
    tableIds: string[];
    mode: 'propose' | 'hold';
    requireAdjacency?: boolean;
    excludeHoldId?: string | null;
    contextVersion?: string | null;
    selectionVersion?: number;
    holdTtlSeconds?: number;
  }): Promise<{ session: ManualAssignmentSession; validation: ManualValidationResult; hold?: { id: string; expiresAt: string | null } | null; context: ManualAssignmentContext }>;
  manualSessionConfirm(input: {
    sessionId: string;
    bookingId: string;
    holdId: string;
    idempotencyKey: string;
    requireAdjacency?: boolean;
    contextVersion?: string | null;
    selectionVersion?: number;
  }): Promise<{ session: ManualAssignmentSession; assignments: ConfirmHoldAssignment[]; context: ManualAssignmentContext }>;
  manualReleaseHold(input: ManualReleaseHoldPayload): Promise<void>;
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
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
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
    const params = new URLSearchParams({ bookingId });
    const res = await fetchJson<ManualAssignmentContext>(`${STAFF_MANUAL_BASE}/context?${params.toString()}`);
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
      return fetchJson<OpsTodayBookingsSummary>(`${OPS_DASHBOARD_BASE}/summary?${params.toString()}`);
    },
    async getBookingHeatmap({ restaurantId, startDate, endDate }) {
      const params = new URLSearchParams({ restaurantId, startDate, endDate });
      return fetchJson<OpsBookingHeatmap>(`${OPS_DASHBOARD_BASE}/heatmap?${params.toString()}`);
    },
    async getRejectionAnalytics({ restaurantId, from, to, bucket }) {
      const params = new URLSearchParams({ restaurantId });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (bucket) params.set('bucket', bucket);
      return fetchJson<OpsRejectionAnalytics>(`${OPS_DASHBOARD_BASE}/rejections?${params.toString()}`);
    },
    async getStrategicSettings({ restaurantId }) {
      const params = new URLSearchParams({ restaurantId });
      return fetchJson<OpsStrategicSettings>(`${OPS_SETTINGS_BASE}/strategic-config?${params.toString()}`);
    },
    async updateStrategicSettings({ restaurantId, weights }) {
      return fetchJson<OpsStrategicSettings>(`${OPS_SETTINGS_BASE}/strategic-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, weights }),
      });
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
    async getBooking(bookingId) {
      return fetchJson<OpsBookingListItem>(`${OPS_BOOKINGS_BASE}/${bookingId}`);
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
    async autoQuoteTables({ bookingId, zoneId, maxTables, requireAdjacency, avoidTables, holdTtlSeconds }) {
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
    async confirmHoldAssignment({ holdId, bookingId, idempotencyKey, requireAdjacency, contextVersion }) {
      if (!contextVersion) {
        contextVersion = await fetchContextVersion(bookingId) ?? '';
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
    async manualValidateSelection({ bookingId, tableIds, requireAdjacency, excludeHoldId, contextVersion }) {
      const { session, context } = await this.manualEnsureSession({ bookingId });
      const version = contextVersion ?? context.contextVersion ?? '';
      const selectionVersion = session?.selectionVersion ?? undefined;
      const payload: Record<string, unknown> = {
        bookingId,
        tableIds,
        mode: 'propose',
        contextVersion: version,
        selectionVersion,
      };
      if (typeof requireAdjacency === 'boolean') payload.requireAdjacency = requireAdjacency;
      if (excludeHoldId) payload.excludeHoldId = excludeHoldId;

      const res = await fetchJson<{
        session: ManualAssignmentSession;
        validation: ManualValidationResult;
        context: ManualAssignmentContext;
      }>(`${STAFF_MANUAL_SESSION_BASE}/${session?.id}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.validation;
    },
    async manualHoldSelection({ bookingId, tableIds, requireAdjacency, excludeHoldId, holdTtlSeconds, contextVersion }) {
      const { session, context } = await this.manualEnsureSession({ bookingId });
      const version = contextVersion ?? context.contextVersion ?? '';
      const selectionVersion = session?.selectionVersion ?? undefined;
      const payload: Record<string, unknown> = {
        bookingId,
        tableIds,
        mode: 'hold',
        contextVersion: version,
        selectionVersion,
      };
      if (typeof requireAdjacency === 'boolean') payload.requireAdjacency = requireAdjacency;
      if (excludeHoldId) payload.excludeHoldId = excludeHoldId;
      if (typeof holdTtlSeconds === 'number') payload.holdTtlSeconds = holdTtlSeconds;

      return fetchJson<ManualHoldResponse>(`${STAFF_MANUAL_SESSION_BASE}/${session?.id}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    async manualConfirmHold({ holdId, bookingId, idempotencyKey, requireAdjacency, contextVersion }) {
      const { session, context } = await this.manualEnsureSession({ bookingId });
      const version = contextVersion ?? context.contextVersion ?? '';
      const selectionVersion = session?.selectionVersion ?? undefined;
      const payload: Record<string, unknown> = {
        bookingId,
        holdId,
        idempotencyKey,
        contextVersion: version,
      };
      if (typeof requireAdjacency === 'boolean') payload.requireAdjacency = requireAdjacency;
      if (typeof selectionVersion === 'number') payload.selectionVersion = selectionVersion;

      return fetchJson<{
        session: ManualAssignmentSession;
        assignments: ConfirmHoldAssignment[];
        context: ManualAssignmentContext;
      }>(`${STAFF_MANUAL_SESSION_BASE}/${session?.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    async getManualAssignmentContext(bookingId, _options) {
      const payload = { bookingId };
      const res = await fetchJson<{ session: ManualAssignmentSession; context: ManualAssignmentContext }>(
        `${STAFF_MANUAL_SESSION_BASE}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      return { ...res.context, session: res.session };
    },
    async manualEnsureSession({ bookingId }) {
      const res = await fetchJson<{ session: ManualAssignmentSession; context: ManualAssignmentContext }>(
        `${STAFF_MANUAL_SESSION_BASE}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        },
      );
      return { ...res.context, session: res.session };
    },
    async manualSessionUpdateSelection({
      sessionId,
      bookingId,
      tableIds,
      mode,
      requireAdjacency,
      excludeHoldId,
      contextVersion,
      selectionVersion,
      holdTtlSeconds,
    }) {
      const payload: Record<string, unknown> = {
        bookingId,
        tableIds,
        mode,
      };
      if (typeof requireAdjacency === 'boolean') payload.requireAdjacency = requireAdjacency;
      if (excludeHoldId) payload.excludeHoldId = excludeHoldId;
      if (typeof selectionVersion === 'number') payload.selectionVersion = selectionVersion;
      if (typeof contextVersion === 'string') payload.contextVersion = contextVersion;
      if (typeof holdTtlSeconds === 'number') payload.holdTtlSeconds = holdTtlSeconds;

      return fetchJson<{
        session: ManualAssignmentSession;
        validation: ManualValidationResult;
        hold?: { id: string; expiresAt: string | null } | null;
        context: ManualAssignmentContext;
      }>(`${STAFF_MANUAL_SESSION_BASE}/${sessionId}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    async manualSessionConfirm({
      sessionId,
      bookingId,
      holdId,
      idempotencyKey,
      requireAdjacency,
      contextVersion,
      selectionVersion,
    }) {
      const payload: Record<string, unknown> = {
        bookingId,
        holdId,
        idempotencyKey,
      };
      if (typeof requireAdjacency === 'boolean') payload.requireAdjacency = requireAdjacency;
      if (typeof contextVersion === 'string') payload.contextVersion = contextVersion;
      if (typeof selectionVersion === 'number') payload.selectionVersion = selectionVersion;

      return fetchJson<{
        session: ManualAssignmentSession;
        assignments: ConfirmHoldAssignment[];
        context: ManualAssignmentContext;
      }>(`${STAFF_MANUAL_SESSION_BASE}/${sessionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    async manualReleaseHold({ holdId, bookingId }) {
      await fetchJson<{ holdId: string; released: boolean }>(`${STAFF_MANUAL_BASE}/hold`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId, bookingId }),
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

  getRejectionAnalytics(): Promise<OpsRejectionAnalytics> {
    this.error('getRejectionAnalytics not implemented');
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

  getBooking(): Promise<OpsBookingListItem> {
    this.error('getBooking not implemented');
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

  manualValidateSelection(): Promise<ManualValidationResult> {
    this.error('manualValidateSelection not implemented');
  }

  manualHoldSelection(): Promise<ManualHoldResponse> {
    this.error('manualHoldSelection not implemented');
  }

  manualConfirmHold(): Promise<{ session: ManualAssignmentSession; assignments: ConfirmHoldAssignment[]; context: ManualAssignmentContext }> {
    this.error('manualConfirmHold not implemented');
  }

  getManualAssignmentContext(): Promise<ManualAssignmentContextWithSession> {
    this.error('getManualAssignmentContext not implemented');
  }

  manualEnsureSession(): Promise<ManualAssignmentContextWithSession> {
    this.error('manualEnsureSession not implemented');
  }

  manualSessionUpdateSelection(): Promise<{
    session: ManualAssignmentSession;
    validation: ManualValidationResult;
    hold?: { id: string; expiresAt: string | null } | null;
    context: ManualAssignmentContext;
  }> {
    this.error('manualSessionUpdateSelection not implemented');
  }

  manualSessionConfirm(): Promise<{
    session: ManualAssignmentSession;
    assignments: ConfirmHoldAssignment[];
    context: ManualAssignmentContext;
  }> {
    this.error('manualSessionConfirm not implemented');
  }

  manualReleaseHold(): Promise<void> {
    this.error('manualReleaseHold not implemented');
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
