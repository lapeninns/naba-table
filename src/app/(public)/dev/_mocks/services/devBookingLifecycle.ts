import { DevBookingDeliveryLogs } from './devBookingDeliveryLogs';

import type { BookingService } from '@/services/ops/bookings';

export class DevBookingLifecycle extends DevBookingDeliveryLogs {
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
      return {
        status: record.status,
        checkedInAt: record.checkedInAt ?? null,
        checkedOutAt: record.checkedOutAt ?? null,
      };
    }
    if (!['pending', 'pending_allocation', 'confirmed'].includes(record.status)) {
      throw this.conflictError(record, 'Booking cannot be checked in from its current status.');
    }
    record.status = 'checked_in';
    record.checkedInAt = performedAt ?? new Date().toISOString();
    record.checkedOutAt = null;
    return {
      status: record.status,
      checkedInAt: record.checkedInAt ?? null,
      checkedOutAt: record.checkedOutAt ?? null,
    };
  };

  checkOutBooking: BookingService['checkOutBooking'] = async ({ id, performedAt }) => {
    const record = this.getBookingRecord(id);
    if (record.status === 'completed') {
      return {
        status: record.status,
        checkedInAt: record.checkedInAt ?? null,
        checkedOutAt: record.checkedOutAt ?? null,
      };
    }
    if (record.status !== 'checked_in') {
      throw this.conflictError(record, 'Booking must be checked in before it can be completed.');
    }
    record.status = 'completed';
    record.checkedOutAt = performedAt ?? new Date().toISOString();
    return {
      status: record.status,
      checkedInAt: record.checkedInAt ?? null,
      checkedOutAt: record.checkedOutAt ?? null,
    };
  };

  markNoShowBooking: BookingService['markNoShowBooking'] = async ({ id }) => {
    const record = this.getBookingRecord(id);
    if (record.status === 'no_show') {
      return {
        status: record.status,
        checkedInAt: record.checkedInAt ?? null,
        checkedOutAt: record.checkedOutAt ?? null,
      };
    }
    if (!['pending', 'pending_allocation', 'confirmed'].includes(record.status)) {
      throw this.conflictError(
        record,
        'Booking cannot be marked as no-show from its current status.',
      );
    }
    record.status = 'no_show';
    record.checkedInAt = null;
    record.checkedOutAt = null;
    return {
      status: record.status,
      checkedInAt: record.checkedInAt ?? null,
      checkedOutAt: record.checkedOutAt ?? null,
    };
  };

  undoNoShowBooking: BookingService['undoNoShowBooking'] = async ({ id }) => {
    const record = this.getBookingRecord(id);
    if (record.status === 'confirmed') {
      return {
        status: record.status,
        checkedInAt: record.checkedInAt ?? null,
        checkedOutAt: record.checkedOutAt ?? null,
      };
    }
    if (record.status !== 'no_show') {
      throw this.conflictError(record, 'Only no-show bookings can be restored.');
    }
    record.status = 'confirmed';
    return {
      status: record.status,
      checkedInAt: record.checkedInAt ?? null,
      checkedOutAt: record.checkedOutAt ?? null,
    };
  };
}
