import { DevBookingLifecycle } from './devBookingLifecycle';

import type { BookingService } from '@/services/ops/bookings';

export class DevBookingAssignments extends DevBookingLifecycle {
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
      timezone: 'Europe/London',
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

  getDialogBundle: BookingService['getDialogBundle'] = async (bookingId) => ({
    booking: await this.getBooking(bookingId),
    assignmentContext: await this.getAssignmentContext(bookingId),
  });

  assignTablesDirect: BookingService['assignTablesDirect'] = async ({ bookingId, tableIds }) => {
    this.assignedByBookingId.set(bookingId, tableIds.slice());
    const totalCapacity = this.tables
      .filter((table) => tableIds.includes(table.id))
      .reduce((sum, table) => sum + table.capacity, 0);

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
}
