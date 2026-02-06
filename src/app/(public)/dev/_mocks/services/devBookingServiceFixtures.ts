import { DEV_BOOKING_ID, DEV_BOOKING_OTHER_ID, DEV_RESTAURANT_ID } from '../devIds';

import type { BookingService } from '@/services/ops/bookings';
import type { OpsBookingListItem, OpsBookingStatus } from '@/types/ops';

export type DevOpsBookingRecord = OpsBookingListItem & {
  createdAt: string;
};

export const DEV_RESTAURANT_NAME = 'Dev Restaurant (Ops Harness)';
export const DEV_RESTAURANT_SLUG = 'dev-restaurant';
export const DEV_TIMEZONE = 'UTC';

function addDaysUtc(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoAt(dateKey: string, time24h: string): string {
  return new Date(`${dateKey}T${time24h}:00Z`).toISOString();
}

export function createDevBookings(): DevOpsBookingRecord[] {
  const now = new Date();
  const todayStart = new Date(now.getTime());
  todayStart.setUTCHours(0, 0, 0, 0);

  const yesterdayKey = utcDateKey(addDaysUtc(todayStart, -1));
  const todayKey = utcDateKey(todayStart);
  const tomorrowKey = utcDateKey(addDaysUtc(todayStart, 1));

  const base: DevOpsBookingRecord[] = [
    {
      id: DEV_BOOKING_ID,
      restaurantId: DEV_RESTAURANT_ID,
      restaurantName: DEV_RESTAURANT_NAME,
      restaurantSlug: DEV_RESTAURANT_SLUG,
      restaurantTimezone: DEV_TIMEZONE,
      reservationIntervalMinutes: 15,
      partySize: 4,
      startIso: isoAt(todayKey, '19:00'),
      endIso: isoAt(todayKey, '20:30'),
      status: 'confirmed',
      notes: 'Window seat if possible.',
      customerName: 'Alex Johnson',
      customerEmail: 'alex@example.com',
      customerPhone: '+447700900123',
      reference: 'DEV123',
      details: null,
      source: 'phone',
      loyaltyTier: 'gold',
      loyaltyPoints: 1200,
      profileNotes: 'Prefers quieter tables.',
      allergies: ['Nuts'],
      dietaryRestrictions: ['Vegetarian'],
      seatingPreference: null,
      marketingOptIn: null,
      tableAssignments: [],
      requiresTableAssignment: true,
      checkedInAt: null,
      checkedOutAt: null,
      createdAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: DEV_BOOKING_OTHER_ID,
      restaurantId: DEV_RESTAURANT_ID,
      restaurantName: DEV_RESTAURANT_NAME,
      restaurantSlug: DEV_RESTAURANT_SLUG,
      restaurantTimezone: DEV_TIMEZONE,
      reservationIntervalMinutes: 15,
      partySize: 2,
      startIso: isoAt(todayKey, '18:30'),
      endIso: isoAt(todayKey, '20:00'),
      status: 'checked_in',
      notes: null,
      customerName: 'Sam Patel',
      customerEmail: null,
      customerPhone: '+447700900999',
      reference: 'DEV456',
      details: null,
      source: 'walk_in',
      loyaltyTier: null,
      loyaltyPoints: null,
      profileNotes: null,
      allergies: null,
      dietaryRestrictions: null,
      seatingPreference: null,
      marketingOptIn: null,
      tableAssignments: [
        {
          groupId: null,
          capacitySum: 4,
          members: [
            {
              tableId: 't-12',
              tableNumber: '12',
              capacity: 4,
              section: 'Main',
            },
          ],
        },
      ],
      requiresTableAssignment: false,
      checkedInAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      checkedOutAt: null,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'dev-priority-waitlist',
      restaurantId: DEV_RESTAURANT_ID,
      restaurantName: DEV_RESTAURANT_NAME,
      restaurantSlug: DEV_RESTAURANT_SLUG,
      restaurantTimezone: DEV_TIMEZONE,
      reservationIntervalMinutes: 15,
      partySize: 3,
      startIso: isoAt(tomorrowKey, '20:00'),
      endIso: isoAt(tomorrowKey, '21:30'),
      status: 'PRIORITY_WAITLIST',
      notes: 'VIP waitlist.',
      customerName: 'Taylor',
      customerEmail: 'taylor@example.com',
      customerPhone: null,
      reference: 'DEV789',
      details: null,
      source: 'online',
      loyaltyTier: 'silver',
      loyaltyPoints: 180,
      profileNotes: null,
      allergies: null,
      dietaryRestrictions: null,
      seatingPreference: null,
      marketingOptIn: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: null,
      checkedOutAt: null,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'dev-cancelled',
      restaurantId: DEV_RESTAURANT_ID,
      restaurantName: DEV_RESTAURANT_NAME,
      restaurantSlug: DEV_RESTAURANT_SLUG,
      restaurantTimezone: DEV_TIMEZONE,
      reservationIntervalMinutes: 15,
      partySize: 2,
      startIso: isoAt(tomorrowKey, '18:00'),
      endIso: isoAt(tomorrowKey, '19:00'),
      status: 'cancelled',
      notes: null,
      customerName: 'Cancelled Guest',
      customerEmail: 'cancelled@example.com',
      customerPhone: null,
      reference: 'DEVCAN',
      details: null,
      source: 'online',
      loyaltyTier: null,
      loyaltyPoints: null,
      profileNotes: null,
      allergies: null,
      dietaryRestrictions: null,
      seatingPreference: null,
      marketingOptIn: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: null,
      checkedOutAt: null,
      createdAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
    },
    {
      id: 'dev-yesterday-completed',
      restaurantId: DEV_RESTAURANT_ID,
      restaurantName: DEV_RESTAURANT_NAME,
      restaurantSlug: DEV_RESTAURANT_SLUG,
      restaurantTimezone: DEV_TIMEZONE,
      reservationIntervalMinutes: 15,
      partySize: 5,
      startIso: isoAt(yesterdayKey, '19:00'),
      endIso: isoAt(yesterdayKey, '20:30'),
      status: 'completed',
      notes: null,
      customerName: 'Past Guest',
      customerEmail: 'past@example.com',
      customerPhone: null,
      reference: 'DEVPAST',
      details: null,
      source: 'online',
      loyaltyTier: null,
      loyaltyPoints: null,
      profileNotes: null,
      allergies: null,
      dietaryRestrictions: null,
      seatingPreference: null,
      marketingOptIn: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: isoAt(yesterdayKey, '19:05'),
      checkedOutAt: isoAt(yesterdayKey, '20:35'),
      createdAt: new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const statuses: OpsBookingStatus[] = [
    'pending',
    'pending_allocation',
    'confirmed',
    'checked_in',
    'completed',
    'cancelled',
    'no_show',
    'PRIORITY_WAITLIST',
  ];

  const generated: DevOpsBookingRecord[] = Array.from({ length: 96 }, (_, index) => {
    const dateKey = index % 3 === 0 ? yesterdayKey : index % 3 === 1 ? todayKey : tomorrowKey;
    const hour = 16 + (index % 7); // 16:00 -> 22:00
    const minute = index % 2 === 0 ? '00' : '30';
    const startIso = isoAt(dateKey, `${String(hour).padStart(2, '0')}:${minute}`);
    const endIso = new Date(new Date(startIso).getTime() + 75 * 60 * 1000).toISOString();
    const status = statuses[index % statuses.length]!;

    return {
      id: `dev-bk-${index + 1}`,
      restaurantId: DEV_RESTAURANT_ID,
      restaurantName: DEV_RESTAURANT_NAME,
      restaurantSlug: DEV_RESTAURANT_SLUG,
      restaurantTimezone: DEV_TIMEZONE,
      reservationIntervalMinutes: 15,
      partySize: (index % 6) + 1,
      startIso,
      endIso,
      status,
      notes: index % 11 === 0 ? 'Dietary note example.' : null,
      customerName: `Guest ${index + 1}`,
      customerEmail: index % 5 === 0 ? `guest.${index + 1}@example.com` : null,
      customerPhone: null,
      reference: `DEVX${String(index + 1).padStart(3, '0')}`,
      details: null,
      source: 'online',
      loyaltyTier: null,
      loyaltyPoints: null,
      profileNotes: null,
      allergies: null,
      dietaryRestrictions: null,
      seatingPreference: null,
      marketingOptIn: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: null,
      checkedOutAt: null,
      createdAt: new Date(now.getTime() - (index + 1) * 4 * 60 * 1000).toISOString(),
    };
  });

  return [...base, ...generated];
}

export function createDevTables(): Awaited<ReturnType<BookingService['getAssignmentContext']>>['tables'] {
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

