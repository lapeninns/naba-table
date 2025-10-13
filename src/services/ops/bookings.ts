import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import type {
  OpsBookingHeatmap,
  OpsBookingListItem,
  OpsBookingsFilters,
  OpsBookingsPage,
  OpsBookingStatus,
  OpsServiceError,
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
};

type UpdateStatusInput = {
  id: string;
  status: 'completed' | 'no_show';
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

export interface BookingService {
  getTodaySummary(params: SummaryParams): Promise<OpsTodayBookingsSummary>;
  getBookingHeatmap(params: HeatmapParams): Promise<OpsBookingHeatmap>;
  listBookings(filters: OpsBookingsFilters): Promise<OpsBookingsPage>;
  updateBooking(input: UpdateBookingInput): Promise<OpsBookingListItem>;
  updateBookingStatus(input: UpdateStatusInput): Promise<{ status: OpsBookingStatus }>;
  cancelBooking(input: CancelBookingInput): Promise<{ id: string; status: string }>;
  createWalkInBooking(input: WalkInInput): Promise<WalkInResponse>;
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
  if (filters.sort) params.set('sort', filters.sort);
  const fromIso = toIsoParam(filters.from ?? undefined);
  if (fromIso) params.set('from', fromIso);
  const toIso = toIsoParam(filters.to ?? undefined);
  if (toIso) params.set('to', toIso);

  return params.toString();
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

  cancelBooking(): Promise<{ id: string; status: string }> {
    this.error('cancelBooking not implemented');
  }

  createWalkInBooking(): Promise<WalkInResponse> {
    this.error('createWalkInBooking not implemented');
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
