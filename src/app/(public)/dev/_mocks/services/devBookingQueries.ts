import { DevBookingState } from './devBookingState';
import { createUnimplementedServiceMethod } from './devUnimplemented';

import type { DevOpsBookingRecord } from './devBookingServiceFixtures';
import type { BookingService } from '@/services/ops/bookings';
import type { OpsBookingsFilters, OpsBookingsPage, OpsBookingStatus } from '@/types/ops';

function parseIso(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export class DevBookingQueries extends DevBookingState {
  protected matchesFilters(record: DevOpsBookingRecord, filters: OpsBookingsFilters): boolean {
    if (record.restaurantId !== filters.restaurantId) return false;
    if (filters.tableId && !this.getAssignedTableIds(record).includes(filters.tableId))
      return false;
    if (filters.status && filters.status !== 'all' && record.status !== filters.status)
      return false;
    if (filters.statuses?.length && !filters.statuses.includes(record.status)) return false;

    const from = parseIso(filters.from);
    const to = parseIso(filters.to);
    if (from || to) {
      const start = parseIso(record.startIso);
      if (!start) return false;
      if (from && start.getTime() < from.getTime()) return false;
      if (to && start.getTime() >= to.getTime()) return false;
    }

    const query = typeof filters.query === 'string' ? normalizeSearch(filters.query) : '';
    if (!query) return true;
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
    return haystack.includes(query);
  }

  getTodaySummary = createUnimplementedServiceMethod<BookingService['getTodaySummary']>(
    'bookingService',
    'getTodaySummary',
  );
  getBookingHeatmap = createUnimplementedServiceMethod<BookingService['getBookingHeatmap']>(
    'bookingService',
    'getBookingHeatmap',
  );
  getStrategicSettings = createUnimplementedServiceMethod<BookingService['getStrategicSettings']>(
    'bookingService',
    'getStrategicSettings',
  );
  updateStrategicSettings = createUnimplementedServiceMethod<
    BookingService['updateStrategicSettings']
  >('bookingService', 'updateStrategicSettings');
  listDisabledAssignments = createUnimplementedServiceMethod<
    BookingService['listDisabledAssignments']
  >('bookingService', 'listDisabledAssignments');
  getBookingHistory = createUnimplementedServiceMethod<BookingService['getBookingHistory']>(
    'bookingService',
    'getBookingHistory',
  );
  createWalkInBooking = createUnimplementedServiceMethod<BookingService['createWalkInBooking']>(
    'bookingService',
    'createWalkInBooking',
  );
  assignTable = createUnimplementedServiceMethod<BookingService['assignTable']>(
    'bookingService',
    'assignTable',
  );
  unassignTable = createUnimplementedServiceMethod<BookingService['unassignTable']>(
    'bookingService',
    'unassignTable',
  );
  confirmHoldAssignment = createUnimplementedServiceMethod<BookingService['confirmHoldAssignment']>(
    'bookingService',
    'confirmHoldAssignment',
  );
  getManualAssignmentContext = createUnimplementedServiceMethod<
    BookingService['getManualAssignmentContext']
  >('bookingService', 'getManualAssignmentContext');

  listBookings: BookingService['listBookings'] = async (filters) => {
    if (!filters.restaurantId) {
      throw new Error('[dev][bookingService] restaurantId is required');
    }
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? 50));
    const sortBy = filters.sortBy === 'created_at' ? 'created_at' : 'start_at';
    const sortDir = filters.sort === 'desc' ? -1 : 1;
    const sorted = this.bookings
      .filter((record) => this.matchesFilters(record, filters))
      .slice()
      .sort((left, right) => {
        const leftDate = parseIso(sortBy === 'created_at' ? left.createdAt : left.startIso);
        const rightDate = parseIso(sortBy === 'created_at' ? right.createdAt : right.startIso);
        const difference = (leftDate?.getTime() ?? 0) - (rightDate?.getTime() ?? 0);
        return difference === 0 ? left.id.localeCompare(right.id) * sortDir : difference * sortDir;
      });
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      items: sorted.slice(startIndex, endIndex).map((record) => this.toOpsBooking(record)),
      pageInfo: { page, pageSize, total: sorted.length, hasNext: endIndex < sorted.length },
    } satisfies OpsBookingsPage;
  };

  getStatusSummary: BookingService['getStatusSummary'] = async ({
    restaurantId,
    from,
    to,
    statuses,
  }) => {
    const filterStatuses = statuses?.length ? statuses : null;
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
      totals[record.status] += 1;
    });

    return {
      restaurantId,
      range: { from: from ?? null, to: to ?? null },
      filter: { statuses: filterStatuses },
      totals,
      generatedAt: new Date().toISOString(),
    };
  };

  getBooking: BookingService['getBooking'] = async (bookingId) =>
    this.toOpsBooking(this.getBookingRecord(bookingId));
}
