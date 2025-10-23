import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => {
  return {
    env: {
      get featureFlags() {
        return {
          loyaltyPilotRestaurantIds: undefined,
          enableTestApi: true,
        guestLookupPolicy: false,
        opsGuardV2: false,
        bookingPastTimeBlocking: false,
        bookingPastTimeGraceMinutes: 5,
      } as const;
      },
      get supabase() {
        return {
          url: "http://localhost:54321",
          anonKey: "test-anon-key",
          serviceKey: "test-service-role-key",
        } as const;
      },
      get app() {
        return {
          url: "http://localhost:3000",
          version: "test",
          commitSha: null,
        } as const;
      },
      get misc() {
        return {
          siteUrl: "http://localhost:3000",
          baseUrl: "http://localhost:3000",
          openAiKey: null,
          analyzeBuild: false,
          bookingDefaultRestaurantId: null,
        } as const;
      },
      get security() {
        return {
          guestLookupPepper: null,
        } as const;
      },
      get reserve() {
        return {
          defaultDurationMinutes: 90,
        } as const;
      },
    },
  };
});

import { DELETE, PATCH } from "./route";

const getUserMock = vi.fn();
const getRouteHandlerSupabaseClientMock = vi.fn(async () => ({
  auth: {
    getUser: getUserMock,
  },
}));
const getServiceSupabaseClientMock = vi.fn();
const getRestaurantScheduleMock = vi.fn();

const requireMembershipForRestaurantMock = vi.fn();
const updateBookingRecordMock = vi.fn();
const softCancelBookingMock = vi.fn();
const logAuditEventMock = vi.fn();
const enqueueBookingUpdatedSideEffectsMock = vi.fn();
const enqueueBookingCancelledSideEffectsMock = vi.fn();

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
  getServiceSupabaseClient: () => getServiceSupabaseClientMock(),
}));

vi.mock("@/server/restaurants/schedule", () => ({
  getRestaurantSchedule: (...args: unknown[]) => getRestaurantScheduleMock(...args),
}));

vi.mock("@/server/team/access", () => ({
  requireMembershipForRestaurant: (...args: unknown[]) => requireMembershipForRestaurantMock(...args),
}));

vi.mock("@/server/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/server/bookings")>("@/server/bookings");
  return {
    ...actual,
    updateBookingRecord: (...args: unknown[]) => updateBookingRecordMock(...args),
    softCancelBooking: (...args: unknown[]) => softCancelBookingMock(...args),
    logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args),
  };
});

vi.mock("@/server/jobs/booking-side-effects", () => ({
  enqueueBookingUpdatedSideEffects: (...args: unknown[]) => enqueueBookingUpdatedSideEffectsMock(...args),
  enqueueBookingCancelledSideEffects: (...args: unknown[]) => enqueueBookingCancelledSideEffectsMock(...args),
  safeBookingPayload: (payload: unknown) => payload,
}));

function createServiceClient(booking: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: booking, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from };
}

describe("/api/ops/bookings/[id] PATCH", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates a booking when the staff member has access", async () => {
    const bookingId = "booking-1";
    const restaurantId = "rest-1";
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "ops@example.com" } }, error: null });
    requireMembershipForRestaurantMock.mockResolvedValue({});

    const existingBooking = {
      id: bookingId,
      restaurant_id: restaurantId,
      party_size: 2,
      status: "confirmed",
      start_at: "2025-05-01T18:00:00.000Z",
      end_at: "2025-05-01T20:00:00.000Z",
      booking_date: "2025-05-01",
      start_time: "18:00",
      end_time: "20:00",
      notes: null,
      restaurants: { name: "Sajilo" },
    };

    const updatedBooking = {
      ...existingBooking,
      party_size: 4,
      start_at: "2025-05-01T19:00:00.000Z",
      end_at: "2025-05-01T21:00:00.000Z",
      start_time: "19:00",
      end_time: "21:00",
    };

    updateBookingRecordMock.mockResolvedValue(updatedBooking);
    getServiceSupabaseClientMock.mockReturnValue(createServiceClient(existingBooking));
    getRestaurantScheduleMock.mockResolvedValue({
      defaultDurationMinutes: 120,
      lastSeatingBufferMinutes: 120,
      timezone: "Europe/London",
    });

    const request = new NextRequest(`http://localhost/api/ops/bookings/${bookingId}`, {
      method: "PATCH",
      body: JSON.stringify({
        startIso: "2025-05-01T19:00:00.000Z",
        endIso: "2025-05-01T21:00:00.000Z",
        partySize: 4,
        notes: "VIP guests",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      // @ts-expect-error Node's fetch requires duplex for request bodies
      duplex: "half",
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: bookingId }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.id).toBe(bookingId);
    expect(json.partySize).toBe(4);
    expect(json.startIso).toBe("2025-05-01T19:00:00.000Z");
    expect(updateBookingRecordMock).toHaveBeenCalled();
    expect(enqueueBookingUpdatedSideEffectsMock).toHaveBeenCalled();
  });

  it("returns 404 when membership check fails to avoid leaking booking existence", async () => {
    const bookingId = "booking-1";
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "ops@example.com" } }, error: null });
    requireMembershipForRestaurantMock.mockRejectedValue(new Error("Forbidden"));
    getServiceSupabaseClientMock.mockReturnValue(createServiceClient({
      id: bookingId,
      restaurant_id: "rest-1",
      start_at: "2025-05-01T18:00:00.000Z",
      end_at: "2025-05-01T20:00:00.000Z",
      party_size: 2,
      status: "confirmed",
    }));

    const request = new NextRequest(`http://localhost/api/ops/bookings/${bookingId}`, {
      method: "PATCH",
      body: JSON.stringify({
        startIso: "2025-05-01T19:00:00.000Z",
        endIso: "2025-05-01T21:00:00.000Z",
        partySize: 4,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      // @ts-expect-error duplex flag for node fetch
      duplex: "half",
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: bookingId }) });
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Booking not found");
  });
});

describe("/api/ops/bookings/[id] DELETE", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cancels a booking when the staff member has access", async () => {
    const bookingId = "booking-1";
    const restaurantId = "rest-1";
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "ops@example.com" } }, error: null });
    requireMembershipForRestaurantMock.mockResolvedValue({});
    const cancelledBooking = {
      id: bookingId,
      restaurant_id: restaurantId,
      status: "cancelled",
    };
    softCancelBookingMock.mockResolvedValue(cancelledBooking);
    getServiceSupabaseClientMock.mockReturnValue(createServiceClient({
      id: bookingId,
      restaurant_id: restaurantId,
      status: "confirmed",
    }));

    const request = new NextRequest(`http://localhost/api/ops/bookings/${bookingId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: bookingId }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.id).toBe(bookingId);
    expect(json.status).toBe("cancelled");
    expect(softCancelBookingMock).toHaveBeenCalled();
    expect(enqueueBookingCancelledSideEffectsMock).toHaveBeenCalled();
  });

  it("returns 404 when membership check fails to avoid leaking booking existence", async () => {
    const bookingId = "booking-1";
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "ops@example.com" } }, error: null });
    requireMembershipForRestaurantMock.mockRejectedValue(new Error("Forbidden"));
    getServiceSupabaseClientMock.mockReturnValue(createServiceClient({
      id: bookingId,
      restaurant_id: "rest-1",
      status: "confirmed",
    }));

    const request = new NextRequest(`http://localhost/api/ops/bookings/${bookingId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: bookingId }) });
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Booking not found");
  });
});
