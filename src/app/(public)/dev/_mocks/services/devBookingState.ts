import { HttpError } from '@/lib/http/errors';

import { createDevBookings, createDevTables } from './devBookingServiceFixtures';

import type { DevOpsBookingRecord } from './devBookingServiceFixtures';
import type { BookingService } from '@/services/ops/bookings';
import type { OpsBookingListItem } from '@/types/ops';

export class DevBookingState {
  protected readonly assignedByBookingId = new Map<string, string[]>();
  protected readonly tables: Awaited<ReturnType<BookingService['getAssignmentContext']>>['tables'];
  protected readonly bookings: DevOpsBookingRecord[];

  constructor() {
    this.tables = createDevTables();
    this.bookings = createDevBookings();
    this.bookings.forEach((booking) => {
      const assigned =
        booking.tableAssignments?.flatMap((group) =>
          group.members.map((member) => member.tableId),
        ) ?? [];
      if (assigned.length > 0) {
        this.assignedByBookingId.set(booking.id, assigned);
      }
    });
  }

  protected toOpsBooking(record: DevOpsBookingRecord): OpsBookingListItem {
    const { createdAt: createdAtRemoved, ...booking } = record;
    void createdAtRemoved;
    return booking;
  }

  protected getBookingRecord(bookingId: string): DevOpsBookingRecord {
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

  protected conflictError(record: DevOpsBookingRecord, message: string): HttpError {
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

  protected getAssignedTableIds(record: DevOpsBookingRecord): string[] {
    const fromMap = this.assignedByBookingId.get(record.id);
    if (fromMap) return fromMap;
    return (
      record.tableAssignments?.flatMap((group) => group.members.map((member) => member.tableId)) ??
      []
    );
  }
}
