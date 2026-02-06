import { createDevEmailDeliveryFeed } from './devEmailDelivery';

import type { BookingService } from '@/services/ops/bookings';
import type { OpsEmailDeliveryFeedResponse, OpsEmailDeliveryRange, EmailDeliveryStatus } from '@/types/emailDelivery';


export class DevBookingService implements BookingService {
  private assignedByBookingId = new Map<string, string[]>();
  private readonly tables: Awaited<ReturnType<BookingService['getAssignmentContext']>>['tables'];

  constructor() {
    this.tables = this.buildTables();
  }

  private buildTables(): Awaited<ReturnType<BookingService['getAssignmentContext']>>['tables'] {
    const baseTables = [
      {
        id: 't-12',
        tableNumber: '12',
        name: 'Window 12',
        capacity: 4,
        minPartySize: 1,
        maxPartySize: 6,
        section: 'Main',
        category: 'standard',
        seatingType: 'standard',
        mobility: 'standard',
        zoneId: 'zone-main',
        zoneActive: true,
        status: 'available',
        active: true,
        position: null,
      },
      {
        id: 't-7',
        tableNumber: '7',
        name: 'Booth 7',
        capacity: 2,
        minPartySize: 1,
        maxPartySize: 2,
        section: 'Booths',
        category: 'booth',
        seatingType: 'booth',
        mobility: 'standard',
        zoneId: 'zone-main',
        zoneActive: true,
        status: 'available',
        active: true,
        position: null,
      },
      {
        id: 't-3',
        tableNumber: '3',
        name: 'Patio 3',
        capacity: 4,
        minPartySize: 1,
        maxPartySize: 8,
        section: 'Patio',
        category: 'standard',
        seatingType: 'standard',
        mobility: 'standard',
        zoneId: 'zone-patio',
        zoneActive: true,
        status: 'available',
        active: true,
        position: null,
      },
    ];

    const generatedTables = Array.from({ length: 57 }, (_, index) => {
      const tableNumber = 20 + index;
      const sections = ['Main', 'Patio', 'Booths', 'Garden'];
      const section = sections[index % sections.length]!;
      const capacityOptions = [2, 4, 6, 8];
      const capacity = capacityOptions[index % capacityOptions.length]!;
      const zoneId = section === 'Patio' ? 'zone-patio' : 'zone-main';

      return {
        id: `t-${tableNumber}`,
        tableNumber: `${tableNumber}`,
        name: `${section} ${tableNumber}`,
        capacity,
        minPartySize: 1,
        maxPartySize: capacity + 2,
        section,
        category: section === 'Booths' ? 'booth' : 'standard',
        seatingType: section === 'Booths' ? 'booth' : 'standard',
        mobility: 'standard',
        zoneId,
        zoneActive: true,
        status: 'available',
        active: true,
        position: null,
      };
    });

    return [...baseTables, ...generatedTables];
  }

  private unimplemented<T extends (...args: unknown[]) => unknown>(name: string): T {
    return (async (..._args: unknown[]) => {
      throw new Error(`[dev][bookingService] ${name} is not implemented`);
    }) as unknown as T;
  }

  getTodaySummary = this.unimplemented<BookingService['getTodaySummary']>('getTodaySummary');
  getBookingHeatmap = this.unimplemented<BookingService['getBookingHeatmap']>('getBookingHeatmap');
  getRejectionAnalytics = this.unimplemented<BookingService['getRejectionAnalytics']>('getRejectionAnalytics');
  getStrategicSettings = this.unimplemented<BookingService['getStrategicSettings']>('getStrategicSettings');
  updateStrategicSettings = this.unimplemented<BookingService['updateStrategicSettings']>('updateStrategicSettings');
  listBookings = this.unimplemented<BookingService['listBookings']>('listBookings');
  listDisabledAssignments = this.unimplemented<BookingService['listDisabledAssignments']>('listDisabledAssignments');
  updateBooking = this.unimplemented<BookingService['updateBooking']>('updateBooking');
  checkInBooking = this.unimplemented<BookingService['checkInBooking']>('checkInBooking');
  checkOutBooking = this.unimplemented<BookingService['checkOutBooking']>('checkOutBooking');
  markNoShowBooking = this.unimplemented<BookingService['markNoShowBooking']>('markNoShowBooking');
  undoNoShowBooking = this.unimplemented<BookingService['undoNoShowBooking']>('undoNoShowBooking');
  getStatusSummary = this.unimplemented<BookingService['getStatusSummary']>('getStatusSummary');
  getBookingHistory = this.unimplemented<BookingService['getBookingHistory']>('getBookingHistory');
  getBooking = this.unimplemented<BookingService['getBooking']>('getBooking');
  getBookingEmailDeliveryLog = this.unimplemented<BookingService['getBookingEmailDeliveryLog']>('getBookingEmailDeliveryLog');
  cancelBooking = this.unimplemented<BookingService['cancelBooking']>('cancelBooking');
  createWalkInBooking = this.unimplemented<BookingService['createWalkInBooking']>('createWalkInBooking');
  assignTable = this.unimplemented<BookingService['assignTable']>('assignTable');
  unassignTable = this.unimplemented<BookingService['unassignTable']>('unassignTable');
  confirmHoldAssignment = this.unimplemented<BookingService['confirmHoldAssignment']>('confirmHoldAssignment');
  getManualAssignmentContext = this.unimplemented<BookingService['getManualAssignmentContext']>('getManualAssignmentContext');

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

    // For the dev harness, we keep server-side filtering minimal: status is supported.
    // Free-text search is handled in the client by query params, but we don't need to
    // replicate full backend matching to validate responsive UI.
    return createDevEmailDeliveryFeed({
      restaurantId: params.restaurantId,
      range,
      page,
      pageSize,
      status: params.status,
    });
  }
}

export function createDevBookingService(): BookingService {
  return new DevBookingService();
}
