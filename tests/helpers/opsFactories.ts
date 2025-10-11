import { randomUUID } from "node:crypto";

import type { BookingRecord } from "@/server/bookings";
import type { CustomerWithProfile } from "@/server/ops/customers";
import type { RestaurantMembershipWithDetails } from "@/server/team/access";

function iso(timestamp?: string): string {
  if (timestamp) return timestamp;
  return new Date().toISOString();
}

export function makeRestaurantMembership(
  overrides: Partial<RestaurantMembershipWithDetails> = {},
): RestaurantMembershipWithDetails {
  const restaurantId = overrides.restaurant_id ?? randomUUID();
  const member: RestaurantMembershipWithDetails = {
    restaurant_id: restaurantId,
    role: overrides.role ?? "manager",
    user_id: overrides.user_id ?? randomUUID(),
    created_at: overrides.created_at ?? iso(),
    updated_at: overrides.updated_at ?? iso(),
    restaurants:
      overrides.restaurants ??
      {
        id: restaurantId,
        name: "Test Restaurant",
        slug: "test-restaurant",
      },
  } as RestaurantMembershipWithDetails;

  return {
    ...member,
    ...overrides,
    restaurants: overrides.restaurants ?? member.restaurants,
  };
}

export function makeBookingRecord(overrides: Partial<BookingRecord> = {}): BookingRecord {
  const restaurantId = overrides.restaurant_id ?? randomUUID();
  const now = iso();
  const base: BookingRecord = {
    id: overrides.id ?? randomUUID(),
    restaurant_id: restaurantId,
    customer_id: overrides.customer_id ?? randomUUID(),
    booking_date: overrides.booking_date ?? "2025-01-01",
    start_time: overrides.start_time ?? "18:00",
    end_time: overrides.end_time ?? "20:00",
    start_at: overrides.start_at ?? new Date("2025-01-01T18:00:00Z").toISOString(),
    end_at: overrides.end_at ?? new Date("2025-01-01T20:00:00Z").toISOString(),
    party_size: overrides.party_size ?? 2,
    booking_type: overrides.booking_type ?? "dinner",
    seating_preference: overrides.seating_preference ?? "any",
    status: overrides.status ?? "confirmed",
    reference: overrides.reference ?? "ABC1234567",
    customer_name: overrides.customer_name ?? "Test Guest",
    customer_email: overrides.customer_email ?? "guest@example.com",
    customer_phone: overrides.customer_phone ?? "+10000000000",
    notes: overrides.notes ?? null,
    marketing_opt_in: overrides.marketing_opt_in ?? false,
    source: overrides.source ?? "ops.walkin",
    loyalty_points_awarded: overrides.loyalty_points_awarded ?? 0,
    pending_ref: overrides.pending_ref ?? null,
    client_request_id: overrides.client_request_id ?? randomUUID(),
    idempotency_key: overrides.idempotency_key ?? null,
    details: overrides.details ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  } as BookingRecord;

  return {
    ...base,
    ...overrides,
  } as BookingRecord;
}

export function makeCustomerWithProfile(
  overrides: Partial<CustomerWithProfile> = {},
): CustomerWithProfile {
  const restaurantId = overrides.restaurantId ?? randomUUID();
  const base: CustomerWithProfile = {
    id: overrides.id ?? randomUUID(),
    restaurantId,
    name: overrides.name ?? "Test Guest",
    email: overrides.email ?? "guest@example.com",
    phone: overrides.phone ?? "+10000000000",
    marketingOptIn: overrides.marketingOptIn ?? false,
    createdAt: overrides.createdAt ?? iso(),
    updatedAt: overrides.updatedAt ?? iso(),
    firstBookingAt: overrides.firstBookingAt ?? null,
    lastBookingAt: overrides.lastBookingAt ?? null,
    totalBookings: overrides.totalBookings ?? 0,
    totalCovers: overrides.totalCovers ?? 0,
    totalCancellations: overrides.totalCancellations ?? 0,
  };

  return {
    ...base,
    ...overrides,
  } as CustomerWithProfile;
}
