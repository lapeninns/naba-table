import { DateTime } from "luxon";

import type { BookingRecord } from "@/server/capacity/types";

import { ZONE_IDS } from "./layout";

const BASE_START = DateTime.fromISO("2025-10-21T19:00:00Z");

const baseBooking: BookingRecord = {
  id: "booking-main-001",
  restaurant_id: "restaurant-1",
  customer_id: "customer-1",
  booking_date: BASE_START.toISODate()!,
  start_time: BASE_START.toFormat("HH:mm"),
  end_time: BASE_START.plus({ hours: 2 }).toFormat("HH:mm"),
  start_at: BASE_START.toISO(),
  end_at: BASE_START.plus({ hours: 2 }).toISO(),
  party_size: 2,
  booking_type: "dinner",
  seating_preference: "any",
  status: "confirmed",
  reference: "REF123456",
  customer_name: "Ada Lovelace",
  customer_email: "ada@example.com",
  customer_phone: "0123456789",
  notes: null,
  marketing_opt_in: false,
  loyalty_points_awarded: 0,
  source: "ops_dashboard",
  auth_user_id: null,
  idempotency_key: "idem-main-1",
  details: {
    requested_zone_id: ZONE_IDS.main,
    channel: "ops",
    window: {
      start: BASE_START.toISO(),
      end: BASE_START.plus({ hours: 2 }).toISO(),
    },
  },
  created_at: BASE_START.minus({ minutes: 30 }).toISO(),
  updated_at: BASE_START.minus({ minutes: 30 }).toISO(),
};

export function createBookingRecordFixture(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    ...baseBooking,
    ...overrides,
    details: overrides.details ?? baseBooking.details,
  };
}

export function createBookingFixtureSet(): BookingRecord[] {
  return [
    createBookingRecordFixture(),
    createBookingRecordFixture({
      id: "booking-patio-001",
      idempotency_key: "idem-patio-1",
      party_size: 4,
      details: {
        requested_zone_id: ZONE_IDS.patio,
        channel: "reserve",
        window: {
          start: BASE_START.plus({ minutes: 15 }).toISO(),
          end: BASE_START.plus({ hours: 2, minutes: 15 }).toISO(),
        },
      },
    }),
    createBookingRecordFixture({
      id: "booking-lounge-001",
      idempotency_key: "idem-lounge-1",
      party_size: 6,
      start_at: BASE_START.plus({ hours: 1 }).toISO(),
      end_at: BASE_START.plus({ hours: 3 }).toISO(),
      start_time: BASE_START.plus({ hours: 1 }).toFormat("HH:mm"),
      end_time: BASE_START.plus({ hours: 3 }).toFormat("HH:mm"),
      details: {
        requested_zone_id: ZONE_IDS.main,
        channel: "manual_hold",
        window: {
          start: BASE_START.plus({ hours: 1 }).toISO(),
          end: BASE_START.plus({ hours: 3 }).toISO(),
        },
      },
    }),
  ];
}
