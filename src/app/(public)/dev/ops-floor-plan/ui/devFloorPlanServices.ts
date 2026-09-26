'use client';

import { DateTime } from 'luxon';

import { HttpError } from '@/lib/http/errors';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { DevBookingService } from '../../_mocks/services/devBookingService';

import type { BookingService } from '@/services/ops/bookings';
import type {
  ListTablesResult,
  TableInventory,
  TableInventoryService,
} from '@/services/ops/tables';
import type {
  OpsTodayBooking,
  OpsTodayBookingsSummary,
  TableTimelineResponse,
  TableTimelineSegment,
} from '@/types/ops';

/**
 * In-memory floor plan for the dev harness. Times are relative to the real
 * clock so the plan always shows a service in progress: "now" sits two and a
 * half hours into dinner, like the reference prototype (19:31 on a Friday).
 */

const TZ = 'Europe/London';
const MIN = 60_000;
const LATENCY_MS = 450;

type Scenario = 'live' | 'empty' | 'error';

type DevTable = TableInventory;
type DevBooking = {
  id: string;
  name: string;
  party: number;
  /** Minutes from "now". */
  start: number;
  minutes: number;
  status: OpsTodayBooking['status'];
  tables: string[];
  checkedIn: number | null;
  checkedOut: number | null;
  allergies?: string[];
  diet?: string[];
  seating?: string;
  reference: string;
};

const ZONES = [
  { id: 'zone-main', name: 'Main room', sortOrder: 0 },
  { id: 'zone-snug', name: 'Snug', sortOrder: 1 },
  { id: 'zone-garden', name: 'Garden', sortOrder: 2 },
];

function table(
  number: string,
  zoneId: string,
  capacity: number,
  opts: Partial<
    Pick<DevTable, 'seatingType' | 'mobility' | 'status' | 'notes' | 'category' | 'position'>
  > = {},
): DevTable {
  const zone = ZONES.find((z) => z.id === zoneId)!;
  return {
    id: `tbl-${number}`,
    restaurantId: DEV_RESTAURANT_ID,
    tableNumber: number,
    capacity,
    minPartySize: capacity <= 2 ? 1 : capacity <= 4 ? 2 : 3,
    maxPartySize: null,
    section: zone.name,
    category: opts.category ?? 'dining',
    seatingType: opts.seatingType ?? 'standard',
    mobility: opts.mobility ?? 'movable',
    zoneId,
    zoneName: zone.name,
    zoneActive: true,
    active: true,
    status: opts.status ?? 'available',
    position: opts.position ?? null,
    notes: opts.notes ?? null,
  };
}

function initialTables(): DevTable[] {
  return [
    table('T1', 'zone-main', 2, { position: { x: 72, y: 106, rotation: 0 } }),
    table('T2', 'zone-main', 2, { position: { x: 200, y: 106, rotation: 0 } }),
    table('T3', 'zone-main', 4, { position: { x: 340, y: 106, rotation: 0 } }),
    table('T4', 'zone-main', 4, { position: { x: 472, y: 106, rotation: 0 } }),
    table('T5', 'zone-main', 4, {
      seatingType: 'booth',
      mobility: 'fixed',
      position: { x: 78, y: 232, rotation: 0 },
    }),
    table('T6', 'zone-main', 6, { position: { x: 244, y: 232, rotation: 0 } }),
    table('T7', 'zone-main', 8, { position: { x: 444, y: 242, rotation: 0 } }),
    table('T8', 'zone-main', 4, {
      status: 'out_of_service',
      notes: 'Wobbly leg, awaiting repair',
      position: { x: 78, y: 372, rotation: 0 },
    }),
    table('T9', 'zone-main', 2, { position: { x: 220, y: 372, rotation: 0 } }),
    table('T10', 'zone-main', 2, { position: { x: 356, y: 372, rotation: 0 } }),
    table('T11', 'zone-main', 2, { position: { x: 496, y: 372, rotation: 0 } }),
    table('S1', 'zone-snug', 4, {
      category: 'lounge',
      seatingType: 'sofa',
      mobility: 'fixed',
      position: { x: 80, y: 106, rotation: 0 },
    }),
    table('S2', 'zone-snug', 2, { category: 'lounge', position: { x: 232, y: 106, rotation: 0 } }),
    table('S3', 'zone-snug', 6, {
      category: 'lounge',
      seatingType: 'sofa',
      mobility: 'fixed',
      position: { x: 70, y: 290, rotation: 90 },
    }),
    table('S4', 'zone-snug', 2, { category: 'lounge', position: { x: 232, y: 264, rotation: 0 } }),
    table('G1', 'zone-garden', 4, { category: 'patio', position: { x: 76, y: 116, rotation: 0 } }),
    table('G2', 'zone-garden', 4, { category: 'patio', position: { x: 216, y: 116, rotation: 0 } }),
    table('G3', 'zone-garden', 4, { category: 'patio', position: { x: 348, y: 116, rotation: 0 } }),
    table('G4', 'zone-garden', 6, { category: 'patio', position: { x: 502, y: 116, rotation: 0 } }),
    table('G5', 'zone-garden', 2, { category: 'patio' }),
    table('G6', 'zone-garden', 2, { category: 'patio' }),
  ];
}

let refSeq = 1000;
function b(
  id: string,
  name: string,
  party: number,
  start: number,
  minutes: number,
  status: DevBooking['status'],
  tables: string[] = [],
  extra: Partial<DevBooking> = {},
): DevBooking {
  refSeq += 1;
  return {
    id,
    name,
    party,
    start,
    minutes,
    status,
    tables: tables.map((t) => `tbl-${t}`),
    checkedIn: null,
    checkedOut: null,
    reference: `NT-${refSeq}`,
    ...extra,
  };
}

/** Offsets are the prototype's clock times minus 19:31. */
function initialBookings(): DevBooking[] {
  return [
    b('d1', 'Hughes', 2, -106, 90, 'checked_in', ['T1'], { checkedIn: -103 }),
    b('d2', 'Morgan', 2, 29, 90, 'confirmed', ['T1']),
    b('d3', 'Ellis', 2, -121, 90, 'completed', ['T2'], { checkedIn: -118, checkedOut: -36 }),
    b('d4', 'Wood', 2, 59, 90, 'confirmed', ['T2']),
    b('d5', 'Okafor', 8, -31, 120, 'checked_in', ['T3', 'T4'], {
      checkedIn: -27,
      diet: ['Birthday'],
    }),
    b('d6', 'Clarke', 4, 14, 90, 'confirmed', ['T5'], { allergies: ['Coeliac'] }),
    b('d7', 'Rahman', 5, -46, 120, 'checked_in', ['T6'], { checkedIn: -40, diet: ['High chair'] }),
    b('d8', 'Grant', 6, -136, 90, 'completed', ['T7'], { checkedIn: -131, checkedOut: -41 }),
    b('d9', 'Novak', 6, 89, 120, 'confirmed', ['T7']),
    b('d19', 'Taylor', 2, -91, 90, 'no_show', ['T9']),
    b('d10', 'Singh', 2, 19, 90, 'confirmed', ['T10']),
    b('d11', 'Bennett', 2, -16, 90, 'confirmed', ['T11']),
    b('d12', 'Dubois', 3, -31, 90, 'checked_in', ['S1'], { checkedIn: -21 }),
    b('d13', 'Price', 2, -121, 105, 'completed', ['S2'], { checkedIn: -120, checkedOut: -19 }),
    b('d14', 'Shah', 2, 104, 90, 'confirmed', ['S2']),
    b('d15', 'Evans', 6, 29, 120, 'confirmed', ['S3'], { diet: ['VIP'] }),
    b('d16', 'Murphy', 2, -16, 90, 'checked_in', ['S4'], { checkedIn: -11 }),
    b('d17', 'Brooks', 4, -61, 120, 'checked_in', ['G1'], { checkedIn: -51 }),
    b('d18', 'Fischer', 5, 74, 120, 'confirmed', ['G4']),
    b('n1', 'Barnes', 4, 14, 90, 'pending_allocation', [], { allergies: ['Nut allergy'] }),
    b('n2', 'Kowalski', 2, 29, 90, 'pending_allocation', [], { seating: 'Wheelchair access' }),
    b('n3', 'Ahmed', 7, 44, 120, 'pending_allocation'),
    b('n4', 'Lindqvist', 3, 59, 90, 'pending'),
  ];
}

export type DevFloorPlanOptions = { scenario: Scenario; failNextAssign: boolean };

export function createDevFloorPlanServices(options: DevFloorPlanOptions) {
  const anchor = Math.floor(Date.now() / (5 * MIN)) * 5 * MIN;
  const at = (offset: number) => anchor + offset * MIN;
  const iso = (ms: number) => DateTime.fromMillis(ms, { zone: 'utc' }).toISO() ?? '';
  const date = DateTime.fromMillis(anchor, { zone: TZ }).toISODate() ?? '';
  const dinner = { start: at(-151), end: at(179) };
  const lunch = { start: at(-451), end: at(-271) };

  const state = {
    tables: options.scenario === 'empty' ? [] : initialTables(),
    bookings: initialBookings(),
    failNextAssign: options.failNextAssign,
  };

  const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  const findBooking = (id: string) => {
    const booking = state.bookings.find((x) => x.id === id);
    if (!booking)
      throw new HttpError({ message: 'Booking not found', status: 404, code: 'BOOKING_NOT_FOUND' });
    return booking;
  };

  function toSummaryBooking(x: DevBooking): OpsTodayBooking {
    const start = at(x.start);
    const end = start + x.minutes * MIN;
    return {
      id: x.id,
      status: x.status,
      bookingType: 'dinner',
      startTime: DateTime.fromMillis(start, { zone: TZ }).toFormat('HH:mm'),
      endTime: DateTime.fromMillis(end, { zone: TZ }).toFormat('HH:mm'),
      partySize: x.party,
      customerName: x.name,
      customerEmail: null,
      customerPhone: null,
      notes: null,
      reference: x.reference,
      details: null,
      source: 'ops',
      allergies: x.allergies ?? [],
      dietaryRestrictions: x.diet ?? [],
      seatingPreference: x.seating ?? null,
      tableAssignments: x.tables.map((id) => {
        const t = state.tables.find((tt) => tt.id === id);
        return {
          groupId: null,
          capacitySum: t?.capacity ?? null,
          members: [
            {
              tableId: id,
              tableNumber: t?.tableNumber ?? '?',
              capacity: t?.capacity ?? null,
              section: t?.section ?? null,
            },
          ],
        };
      }),
      requiresTableAssignment: x.tables.length === 0,
      checkedInAt: x.checkedIn === null ? null : iso(at(x.checkedIn)),
      checkedOutAt: x.checkedOut === null ? null : iso(at(x.checkedOut)),
      startIso: iso(start),
      endIso: iso(end),
    };
  }

  function summary(): OpsTodayBookingsSummary {
    const bookings = state.bookings.map(toSummaryBooking);
    return {
      meta: { date, timezone: TZ, restaurantId: DEV_RESTAURANT_ID },
      date,
      timezone: TZ,
      restaurantId: DEV_RESTAURANT_ID,
      totals: {
        total: bookings.length,
        confirmed: bookings.filter((x) => x.status === 'confirmed').length,
        completed: bookings.filter((x) => x.status === 'completed').length,
        pending: bookings.filter((x) => x.status === 'pending').length,
        cancelled: 0,
        noShow: bookings.filter((x) => x.status === 'no_show').length,
        upcoming: bookings.filter((x) => x.status === 'confirmed').length,
        covers: bookings.reduce((sum, x) => sum + x.partySize, 0),
      },
      bookings,
    };
  }

  function timeline(): TableTimelineResponse {
    const windowStart = lunch.start;
    const windowEnd = dinner.end;
    const tables = state.tables.map((t) => {
      const segments: TableTimelineSegment[] = state.bookings
        .filter(
          (x) => x.tables.includes(t.id) && x.status !== 'no_show' && x.status !== 'cancelled',
        )
        .map((x) => ({
          start: iso(at(x.start)),
          end: iso(at(x.start + x.minutes)),
          state: 'reserved' as const,
          serviceKey: 'dinner' as const,
          booking: {
            id: x.id,
            customerName: x.name,
            partySize: x.party,
            status: x.status,
            startAt: iso(at(x.start)),
            endAt: iso(at(x.start + x.minutes)),
          },
        }));
      if (t.tableNumber === 'T9') {
        segments.push({
          start: iso(at(-2)),
          end: iso(at(5)),
          state: 'hold',
          serviceKey: 'dinner',
          hold: { id: 'hold-1', bookingId: null, startAt: iso(at(-2)), endAt: iso(at(5)) },
        });
      }
      return {
        table: {
          id: t.id,
          tableNumber: t.tableNumber,
          capacity: t.capacity,
          zoneId: t.zoneId,
          zoneName: t.zoneName,
          status: t.status,
          active: t.active,
        },
        stats: { occupancyMinutes: 0, totalMinutes: 0, occupancyPercentage: 0, nextStateAt: null },
        segments,
      };
    });
    return {
      date,
      timezone: TZ,
      window: { start: iso(windowStart), end: iso(windowEnd), isClosed: false },
      slots: [],
      services: [
        {
          key: 'lunch',
          label: 'Lunch',
          start: iso(lunch.start),
          end: iso(lunch.end),
          slotCount: 12,
        },
        {
          key: 'dinner',
          label: 'Dinner',
          start: iso(dinner.start),
          end: iso(dinner.end),
          slotCount: 22,
        },
      ],
      summary: null,
      tables,
    };
  }

  function listResult(): ListTablesResult {
    return {
      tables: state.tables.map((t) => ({ ...t })),
      summary: {
        totalTables: state.tables.length,
        totalCapacity: state.tables.reduce((s, t) => s + t.capacity, 0),
        availableTables: state.tables.filter((t) => t.status === 'available').length,
        zones: ZONES.map((z) => ({ ...z, active: true })),
        serviceCapacities: [],
      },
    };
  }

  const tableService: TableInventoryService = {
    async list() {
      await delay();
      if (options.scenario === 'error') {
        throw new HttpError({ message: 'Timed out', status: 504, code: 'FP_FETCH_TIMEOUT' });
      }
      return listResult();
    },
    async create() {
      throw new Error('[dev][floor-plan] create is not implemented');
    },
    async update(tableId, payload) {
      await delay();
      const t = state.tables.find((x) => x.id === tableId);
      if (!t) throw new HttpError({ message: 'Table not found', status: 404 });
      if (payload.position !== undefined) t.position = payload.position ?? null;
      return { ...t };
    },
    async remove() {
      throw new Error('[dev][floor-plan] remove is not implemented');
    },
    async timeline() {
      await delay();
      return timeline();
    },
  };

  class DevFloorPlanBookingService extends DevBookingService {
    override getTodaySummary: BookingService['getTodaySummary'] = async () => {
      await delay();
      return summary();
    };

    override assignTablesDirect: BookingService['assignTablesDirect'] = async ({
      bookingId,
      tableIds,
    }) => {
      await delay();
      const booking = findBooking(bookingId);
      if (state.failNextAssign) {
        state.failNextAssign = false;
        const t = state.tables.find((x) => x.id === tableIds[0]);
        state.bookings.push(
          b(
            `x${Date.now()}`,
            'Reed',
            2,
            booking.start - 15,
            90,
            'confirmed',
            t ? [t.tableNumber] : [],
          ),
        );
        throw new HttpError({
          message: 'Table was just booked',
          status: 409,
          code: 'ASSIGNMENT_CONFLICT',
        });
      }
      booking.tables = [...new Set([...booking.tables, ...tableIds])];
      if (booking.status === 'pending' || booking.status === 'pending_allocation')
        booking.status = 'confirmed';
      const capacity = state.tables
        .filter((t) => booking.tables.includes(t.id))
        .reduce((s, t) => s + t.capacity, 0);
      return {
        success: true,
        assignments: tableIds.map((tableId) => ({
          id: `${bookingId}:${tableId}`,
          booking_id: bookingId,
          table_id: tableId,
          assigned_at: new Date().toISOString(),
          assigned_by: null,
        })),
        booking: { id: bookingId, status: booking.status, party_size: booking.party },
        summary: {
          tableCount: booking.tables.length,
          totalCapacity: capacity,
          partySize: booking.party,
          slack: capacity - booking.party,
        },
      };
    };

    override unassignTablesDirect: BookingService['unassignTablesDirect'] = async ({
      bookingId,
      tableIds,
    }) => {
      await delay();
      const booking = findBooking(bookingId);
      const before = booking.tables.length;
      booking.tables = booking.tables.filter((id) => !tableIds.includes(id));
      if (booking.tables.length === 0 && booking.status === 'confirmed') booking.status = 'pending';
      return { success: true, removedCount: before - booking.tables.length };
    };

    override checkInBooking: BookingService['checkInBooking'] = async ({ id }) => {
      await delay();
      const booking = findBooking(id);
      booking.status = 'checked_in';
      booking.checkedIn = Math.round((Date.now() - anchor) / MIN);
      return {
        status: booking.status,
        checkedInAt: iso(at(booking.checkedIn)),
        checkedOutAt: null,
      };
    };

    override checkOutBooking: BookingService['checkOutBooking'] = async ({ id }) => {
      await delay();
      const booking = findBooking(id);
      booking.status = 'completed';
      booking.checkedOut = Math.round((Date.now() - anchor) / MIN);
      return {
        status: booking.status,
        checkedInAt: booking.checkedIn === null ? null : iso(at(booking.checkedIn)),
        checkedOutAt: iso(at(booking.checkedOut)),
      };
    };

    override markNoShowBooking: BookingService['markNoShowBooking'] = async ({ id }) => {
      await delay();
      const booking = findBooking(id);
      booking.status = 'no_show';
      return { status: booking.status, checkedInAt: null, checkedOutAt: null };
    };

    override undoNoShowBooking: BookingService['undoNoShowBooking'] = async ({ id }) => {
      await delay();
      const booking = findBooking(id);
      booking.status = 'confirmed';
      return { status: booking.status, checkedInAt: null, checkedOutAt: null };
    };
  }

  return {
    bookingService: () => new DevFloorPlanBookingService(),
    tableInventoryService: () => tableService,
  };
}
