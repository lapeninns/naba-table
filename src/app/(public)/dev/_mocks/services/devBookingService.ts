import { HttpError } from '@/lib/http/errors';

import { createDevBookings, createDevTables, type DevOpsBookingRecord } from './devBookingServiceFixtures';
import { createDevEmailDeliveryFeed } from './devEmailDelivery';

import type { BookingService } from '@/services/ops/bookings';
import type {
  BookingEmailDeliveryResponse,
  EmailDeliveryEventDTO,
  EmailDeliveryStatus,
  OpsEmailDeliveryContentResponse,
  OpsEmailDeliveryFeedResponse,
  OpsEmailDeliveryRange,
} from '@/types/emailDelivery';
import type { OpsBookingListItem, OpsBookingsFilters, OpsBookingsPage, OpsBookingStatus } from '@/types/ops';

function parseIso(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export class DevBookingService implements BookingService {
  private assignedByBookingId = new Map<string, string[]>();
  private readonly tables: Awaited<ReturnType<BookingService['getAssignmentContext']>>['tables'];
  private readonly bookings: DevOpsBookingRecord[];

  constructor() {
    this.tables = createDevTables();
    this.bookings = createDevBookings();
    this.bookings.forEach((booking) => {
      const assigned = booking.tableAssignments?.flatMap((group) => group.members.map((member) => member.tableId)) ?? [];
      if (assigned.length > 0) {
        this.assignedByBookingId.set(booking.id, assigned);
      }
    });
  }

  private unimplemented<T extends (...args: unknown[]) => unknown>(name: string): T {
    return (async (..._args: unknown[]) => {
      throw new Error(`[dev][bookingService] ${name} is not implemented`);
    }) as unknown as T;
  }

  private toOpsBooking(record: DevOpsBookingRecord): OpsBookingListItem {
    const { createdAt: createdAtRemoved, ...booking } = record;
    void createdAtRemoved;
    return booking;
  }

  private getBookingRecord(bookingId: string): DevOpsBookingRecord {
    const record = this.bookings.find((booking) => booking.id === bookingId);
    if (!record) {
      throw new HttpError({
        status: 404,
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found.',
      });
    }
    return record;
  }

  private conflictError(record: DevOpsBookingRecord, message: string): HttpError {
    return new HttpError({
      status: 409,
      code: 'BOOKING_STATUS_CONFLICT',
      message,
      details: {
        currentStatus: record.status,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  private getAssignedTableIds(record: DevOpsBookingRecord): string[] {
    const fromMap = this.assignedByBookingId.get(record.id);
    if (fromMap) return fromMap;
    return record.tableAssignments?.flatMap((group) => group.members.map((member) => member.tableId)) ?? [];
  }

  private matchesFilters(record: DevOpsBookingRecord, filters: OpsBookingsFilters): boolean {
    if (record.restaurantId !== filters.restaurantId) return false;

    if (filters.tableId) {
      const assigned = this.getAssignedTableIds(record);
      if (!assigned.includes(filters.tableId)) return false;
    }

    if (filters.status && filters.status !== 'all' && record.status !== filters.status) {
      return false;
    }

    if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(record.status)) {
      return false;
    }

    const from = parseIso(filters.from);
    const to = parseIso(filters.to);
    if (from || to) {
      const start = parseIso(record.startIso);
      if (!start) return false;
      if (from && start.getTime() < from.getTime()) return false;
      // Treat `to` as an exclusive upper bound for predictable day/window filtering.
      if (to && start.getTime() >= to.getTime()) return false;
    }

    const query = typeof filters.query === 'string' ? normalizeSearch(filters.query) : '';
    if (query) {
      const haystack = normalizeSearch(
        [
          record.customerName,
          record.reference,
          record.customerEmail,
          record.customerPhone,
          record.notes,
        ]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .join(' '),
      );
      if (!haystack.includes(query)) return false;
    }

    return true;
  }

  getTodaySummary = this.unimplemented<BookingService['getTodaySummary']>('getTodaySummary');
  getBookingHeatmap = this.unimplemented<BookingService['getBookingHeatmap']>('getBookingHeatmap');
  getRejectionAnalytics = this.unimplemented<BookingService['getRejectionAnalytics']>('getRejectionAnalytics');
  getStrategicSettings = this.unimplemented<BookingService['getStrategicSettings']>('getStrategicSettings');
  updateStrategicSettings = this.unimplemented<BookingService['updateStrategicSettings']>('updateStrategicSettings');
  listDisabledAssignments = this.unimplemented<BookingService['listDisabledAssignments']>('listDisabledAssignments');
  getBookingHistory = this.unimplemented<BookingService['getBookingHistory']>('getBookingHistory');
  createWalkInBooking = this.unimplemented<BookingService['createWalkInBooking']>('createWalkInBooking');
  assignTable = this.unimplemented<BookingService['assignTable']>('assignTable');
  unassignTable = this.unimplemented<BookingService['unassignTable']>('unassignTable');
  confirmHoldAssignment = this.unimplemented<BookingService['confirmHoldAssignment']>('confirmHoldAssignment');
  getManualAssignmentContext = this.unimplemented<BookingService['getManualAssignmentContext']>('getManualAssignmentContext');

  listBookings: BookingService['listBookings'] = async (filters) => {
    if (!filters.restaurantId) {
      throw new Error('[dev][bookingService] restaurantId is required');
    }

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? 50));

    const candidates = this.bookings.filter((record) => this.matchesFilters(record, filters));

    const sortBy = filters.sortBy === 'created_at' ? 'created_at' : 'start_at';
    const sortDir = filters.sort === 'desc' ? -1 : 1;

    const sorted = candidates.slice().sort((a, b) => {
      const aIso = sortBy === 'created_at' ? a.createdAt : a.startIso;
      const bIso = sortBy === 'created_at' ? b.createdAt : b.startIso;
      const aDate = parseIso(aIso);
      const bDate = parseIso(bIso);
      const aMs = aDate ? aDate.getTime() : 0;
      const bMs = bDate ? bDate.getTime() : 0;
      if (aMs === bMs) {
        return a.id.localeCompare(b.id) * sortDir;
      }
      return (aMs - bMs) * sortDir;
    });

    const total = sorted.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageItems = sorted.slice(startIndex, endIndex).map((record) => this.toOpsBooking(record));

    return {
      items: pageItems,
      pageInfo: {
        page,
        pageSize,
        total,
        hasNext: endIndex < total,
      },
    } satisfies OpsBookingsPage;
  };

  getStatusSummary: BookingService['getStatusSummary'] = async ({ restaurantId, from, to, statuses }) => {
    const filterStatuses = statuses && statuses.length > 0 ? statuses : null;
    const range: { from: string | null; to: string | null } = {
      from: from ?? null,
      to: to ?? null,
    };

    const totals: Record<OpsBookingStatus, number> = {
      pending: 0,
      pending_allocation: 0,
      confirmed: 0,
      checked_in: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
      PRIORITY_WAITLIST: 0,
    };

    const fromDate = parseIso(from);
    const toDate = parseIso(to);

    this.bookings.forEach((record) => {
      if (record.restaurantId !== restaurantId) return;
      if (filterStatuses && !filterStatuses.includes(record.status)) return;
      const start = parseIso(record.startIso);
      if (!start) return;
      if (fromDate && start.getTime() < fromDate.getTime()) return;
      if (toDate && start.getTime() >= toDate.getTime()) return;
      totals[record.status] = (totals[record.status] ?? 0) + 1;
    });

    return {
      restaurantId,
      range,
      filter: { statuses: filterStatuses },
      totals,
      generatedAt: new Date().toISOString(),
    };
  };

  getBooking: BookingService['getBooking'] = async (bookingId) => this.toOpsBooking(this.getBookingRecord(bookingId));

  getBookingEmailDeliveryLog: BookingService['getBookingEmailDeliveryLog'] = async (
    bookingId,
  ): Promise<BookingEmailDeliveryResponse> => {
    const booking = this.getBookingRecord(bookingId);
    const recipientEmail = booking.customerEmail ?? 'guest@example.com';
    const now = new Date();
    const base: Omit<EmailDeliveryEventDTO, 'id' | 'status' | 'occurredAt'> = {
      bookingId,
      restaurantId: booking.restaurantId ?? null,
      emailType: 'booking_confirmation',
      templateType: 'booking_confirmation',
      recipientEmail,
      messageId: `dev-msg-${bookingId}`,
      provider: 'mock',
      error: null,
      metadata: null,
    };

    return {
      ok: true,
      bookingId,
      events: [
        {
          ...base,
          id: `dev-mail-${bookingId}-sent`,
          status: 'sent',
          occurredAt: new Date(now.getTime() - 60_000).toISOString(),
        },
        {
          ...base,
          id: `dev-mail-${bookingId}-delivered`,
          status: 'delivered',
          occurredAt: new Date(now.getTime() - 30_000).toISOString(),
        },
      ],
    };
  };

  updateBooking: BookingService['updateBooking'] = async (input) => {
    const record = this.getBookingRecord(input.id);
    record.startIso = input.startIso;
    record.endIso = input.endIso;
    record.partySize = input.partySize;
    record.notes = input.notes ?? null;
    return this.toOpsBooking(record);
  };

  cancelBooking: BookingService['cancelBooking'] = async ({ id }) => {
    const record = this.getBookingRecord(id);
    record.status = 'cancelled';
    record.checkedInAt = null;
    record.checkedOutAt = null;
    return { id, status: record.status };
  };

  checkInBooking: BookingService['checkInBooking'] = async ({ id, performedAt }) => {
    const record = this.getBookingRecord(id);
    if (record.status === 'checked_in') {
      return { status: record.status, checkedInAt: record.checkedInAt ?? null, checkedOutAt: record.checkedOutAt ?? null };
    }
    if (!['pending', 'pending_allocation', 'confirmed'].includes(record.status)) {
      throw this.conflictError(record, 'Booking cannot be checked in from its current status.');
    }

    record.status = 'checked_in';
    record.checkedInAt = performedAt ?? new Date().toISOString();
    record.checkedOutAt = null;
    return { status: record.status, checkedInAt: record.checkedInAt ?? null, checkedOutAt: record.checkedOutAt ?? null };
  };

  checkOutBooking: BookingService['checkOutBooking'] = async ({ id, performedAt }) => {
    const record = this.getBookingRecord(id);
    if (record.status === 'completed') {
      return { status: record.status, checkedInAt: record.checkedInAt ?? null, checkedOutAt: record.checkedOutAt ?? null };
    }
    if (record.status !== 'checked_in') {
      throw this.conflictError(record, 'Booking must be checked in before it can be completed.');
    }

    record.status = 'completed';
    record.checkedOutAt = performedAt ?? new Date().toISOString();
    return { status: record.status, checkedInAt: record.checkedInAt ?? null, checkedOutAt: record.checkedOutAt ?? null };
  };

  markNoShowBooking: BookingService['markNoShowBooking'] = async ({ id }) => {
    const record = this.getBookingRecord(id);
    if (record.status === 'no_show') {
      return { status: record.status, checkedInAt: record.checkedInAt ?? null, checkedOutAt: record.checkedOutAt ?? null };
    }
    if (!['pending', 'pending_allocation', 'confirmed'].includes(record.status)) {
      throw this.conflictError(record, 'Booking cannot be marked as no-show from its current status.');
    }
    record.status = 'no_show';
    record.checkedInAt = null;
    record.checkedOutAt = null;
    return { status: record.status, checkedInAt: record.checkedInAt ?? null, checkedOutAt: record.checkedOutAt ?? null };
  };

  undoNoShowBooking: BookingService['undoNoShowBooking'] = async ({ id }) => {
    const record = this.getBookingRecord(id);
    if (record.status === 'confirmed') {
      return { status: record.status, checkedInAt: record.checkedInAt ?? null, checkedOutAt: record.checkedOutAt ?? null };
    }
    if (record.status !== 'no_show') {
      throw this.conflictError(record, 'Only no-show bookings can be restored.');
    }
    record.status = 'confirmed';
    return { status: record.status, checkedInAt: record.checkedInAt ?? null, checkedOutAt: record.checkedOutAt ?? null };
  };

  getAssignmentContext: BookingService['getAssignmentContext'] = async (bookingId) => {
    const assigned = this.assignedByBookingId.get(bookingId) ?? [];

    return {
      booking: {
        id: bookingId,
        restaurant_id: 'dev-restaurant',
        start_at: null,
        booking_date: '2026-02-10',
        start_time: '19:00',
        party_size: 4,
        status: 'confirmed',
      },
      tables: this.tables,
      bookingAssignments: assigned,
      conflicts: [
        {
          tableId: 't-3',
          bookingId: 'other-booking',
          startAt: '2026-02-10T19:15:00Z',
          endAt: '2026-02-10T20:15:00Z',
          status: 'confirmed',
        },
      ],
      window: { startAt: '18:00', endAt: '22:00' },
      serverNow: new Date().toISOString(),
      holds: [],
    };
  };

  assignTablesDirect: BookingService['assignTablesDirect'] = async ({
    bookingId,
    tableIds,
  }) => {
    this.assignedByBookingId.set(bookingId, tableIds.slice());

    const totalCapacity = this.tables
      .filter((t) => tableIds.includes(t.id))
      .reduce((sum, t) => sum + t.capacity, 0);

    return {
      success: true,
      assignments: tableIds.map((tableId) => ({
        id: `assign-${tableId}`,
        booking_id: bookingId,
        table_id: tableId,
        assigned_at: new Date().toISOString(),
        assigned_by: null,
      })),
      booking: { id: bookingId, status: 'confirmed', party_size: 4 },
      summary: {
        tableCount: tableIds.length,
        totalCapacity,
        partySize: 4,
        slack: totalCapacity - 4,
      },
    };
  };

  unassignTablesDirect: BookingService['unassignTablesDirect'] = async ({
    bookingId,
    tableIds,
  }) => {
    const assigned = this.assignedByBookingId.get(bookingId) ?? [];
    this.assignedByBookingId.set(
      bookingId,
      assigned.filter((id) => !tableIds.includes(id)),
    );
    return { success: true, removedCount: tableIds.length };
  };

  autoQuoteTables: BookingService['autoQuoteTables'] = async () => ({
    holdId: null,
    expiresAt: null,
    window: null,
    candidate: {
      tableIds: ['t-12'],
      tableNumbers: ['12'],
      totalCapacity: 4,
      tableCount: 1,
      slack: 0,
      adjacencyStatus: 'single',
    },
    alternates: [],
    nextTimes: [],
    reason: null,
    zoneId: null,
    requireAdjacency: false,
    serviceFallback: { usedFallback: false, fallbackService: null },
  });

  async getRestaurantEmailDeliveryFeed(params: {
    restaurantId?: string;
    range?: OpsEmailDeliveryRange;
    page?: number;
    pageSize?: number;
    status?: EmailDeliveryStatus[];
    recipientEmail?: string;
    messageId?: string;
    bookingRef?: string;
    templateType?: string;
    emailType?: string;
  }): Promise<OpsEmailDeliveryFeedResponse> {
    if (!params.restaurantId) {
      throw new Error('[dev][bookingService] restaurantId is required');
    }
    const range = params.range ?? '7d';
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, params.pageSize ?? 50));

    return createDevEmailDeliveryFeed({
      restaurantId: params.restaurantId,
      range,
      page,
      pageSize,
      status: params.status,
      recipientEmail: params.recipientEmail,
      messageId: params.messageId,
      bookingRef: params.bookingRef,
      templateType: params.templateType,
      emailType: params.emailType,
    });
  }

  async getEmailDeliveryMessageContent(params: {
    messageId: string;
    recipientEmail?: string;
  }): Promise<OpsEmailDeliveryContentResponse> {
    const messageId = params.messageId?.trim();
    if (!messageId) {
      return { ok: false, code: 'INTERNAL', error: 'Message id is required', message: 'Message id is required' };
    }

    const to = params.recipientEmail?.trim() ? [params.recipientEmail.trim()] : [];
    const isSimulatedFailure = messageId.toLowerCase().includes('fail');

    return {
      ok: true,
      content: {
        messageId,
        subject: isSimulatedFailure ? 'DEV: Booking email (simulated failure)' : 'DEV: Booking email preview',
        from: 'no-reply@example.test',
        to,
        cc: null,
        bcc: null,
        replyTo: null,
        createdAt: new Date().toISOString(),
        scheduledAt: null,
        lastEvent: isSimulatedFailure ? 'failed' : 'delivered',
        text:
          'This is a dev-only email preview.\n\nIn production, this content is fetched from Resend using the message id.',
        html: `<!doctype html><html><body style="font-family:system-ui;line-height:1.4"><h1>Dev Email Preview</h1><p><strong>Message:</strong> ${messageId}</p><p>In production, this content comes from Resend.</p></body></html>`,
      },
    };
  }
}

export function createDevBookingService(): BookingService {
  return new DevBookingService();
}
