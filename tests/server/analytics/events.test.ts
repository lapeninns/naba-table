import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_SCHEMA_VERSION,
  recordBookingCancelledEvent,
  recordBookingCreatedEvent,
} from "@/server/analytics";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type MockInsert = ReturnType<typeof vi.fn>;

function createMockClient(insertImpl: MockInsert) {
  return {
    from: vi.fn(() => ({
      insert: insertImpl,
    })),
  } as unknown as SupabaseClient<Database, "public", any>;
}

describe("analytics events", () => {
  const occurredAt = "2025-01-21T10:30:45.000Z";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("records booking.created event with expected payload shape", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const client = createMockClient(insertMock);

    await recordBookingCreatedEvent(client, {
      bookingId: "booking-1",
      restaurantId: "restaurant-1",
      customerId: "customer-1",
      status: "confirmed",
      partySize: 4,
      bookingType: "dine_in",
      seatingPreference: "indoor",
      source: "web",
      loyaltyPointsAwarded: 15,
      clientRequestId: "req-123",
      idempotencyKey: "idem-456",
      pendingRef: "pending-789",
      occurredAt,
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      event_type: "booking.created",
      schema_version: ANALYTICS_SCHEMA_VERSION,
      restaurant_id: "restaurant-1",
      booking_id: "booking-1",
      customer_id: "customer-1",
      occurred_at: occurredAt,
      emitted_by: "server",
      payload: {
        booking_id: "booking-1",
        restaurant_id: "restaurant-1",
        customer_id: "customer-1",
        status: "confirmed",
        party_size: 4,
        booking_type: "dine_in",
        seating_preference: "indoor",
        source: "web",
        loyalty_points_awarded: 15,
        client_request_id: "req-123",
        idempotency_key: "idem-456",
        pending_ref: "pending-789",
        version: ANALYTICS_SCHEMA_VERSION,
      },
    });
  });

  it("defaults optional booking.created fields when omitted", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const client = createMockClient(insertMock);

    await recordBookingCreatedEvent(client, {
      bookingId: "booking-2",
      restaurantId: "restaurant-2",
      status: "pending",
      partySize: 2,
      bookingType: "takeaway",
      seatingPreference: "outdoor",
      source: "kiosk",
    });

    const payload = insertMock.mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload.payload).toMatchObject({
      loyalty_points_awarded: 0,
      client_request_id: null,
      idempotency_key: null,
      pending_ref: null,
      version: ANALYTICS_SCHEMA_VERSION,
    });
    expect(payload.customer_id).toBeNull();
    expect(typeof payload.occurred_at).toBe("string");
  });

  it("throws when Supabase insert returns an error", async () => {
    const insertError = new Error("insert failed");
    const insertMock = vi.fn().mockResolvedValue({ error: insertError });
    const client = createMockClient(insertMock);

    await expect(
      recordBookingCreatedEvent(client, {
        bookingId: "booking-3",
        restaurantId: "restaurant-3",
        status: "confirmed",
        partySize: 3,
        bookingType: "dine_in",
        seatingPreference: "indoor",
        source: "app",
      }),
    ).rejects.toBe(insertError);
  });

  it("records booking.cancelled event with previous status and actor", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const client = createMockClient(insertMock);

    await recordBookingCancelledEvent(client, {
      bookingId: "booking-4",
      restaurantId: "restaurant-4",
      customerId: null,
      previousStatus: "confirmed",
      cancelledBy: "staff",
      occurredAt,
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0]?.[0]).toMatchObject({
      event_type: "booking.cancelled",
      restaurant_id: "restaurant-4",
      booking_id: "booking-4",
      customer_id: null,
      occurred_at: occurredAt,
      payload: {
        booking_id: "booking-4",
        previous_status: "confirmed",
        cancelled_by: "staff",
        version: ANALYTICS_SCHEMA_VERSION,
      },
    });
  });
});
