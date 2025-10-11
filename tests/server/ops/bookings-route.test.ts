import { describe, expect, beforeAll, beforeEach, vi, it } from "vitest";

import { makeBookingRecord, makeRestaurantMembership } from "@/tests/helpers/opsFactories";

const mockGetRouteHandlerSupabaseClient = vi.fn();
const mockGetServiceSupabaseClient = vi.fn();

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: mockGetRouteHandlerSupabaseClient,
  getServiceSupabaseClient: mockGetServiceSupabaseClient,
}));

const mockRequireMembershipForRestaurant = vi.fn();
vi.mock("@/server/team/access", () => ({
  requireMembershipForRestaurant: mockRequireMembershipForRestaurant,
}));

const mockUpsertCustomer = vi.fn();
const mockFetchBookingsForContact = vi.fn();
const mockGenerateUniqueBookingReference = vi.fn();
const mockInsertBookingRecord = vi.fn();
const mockEnqueueBookingCreatedSideEffects = vi.fn();
const mockSafeBookingPayload = vi.fn((value) => value);
const mockFindCustomerByContact = vi.fn();

const RESTAURANT_ID = "4a89f4b1-55cb-4e4f-9e5a-123456789abc";

vi.mock("@/server/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/server/bookings")>("@/server/bookings");
  return {
    ...actual,
    generateUniqueBookingReference: mockGenerateUniqueBookingReference,
    insertBookingRecord: mockInsertBookingRecord,
  };
});

vi.mock("@/server/customers", () => ({
  upsertCustomer: mockUpsertCustomer,
  fetchBookingsForContact: mockFetchBookingsForContact,
  normalizeEmail: (value: string) => value,
  findCustomerByContact: mockFindCustomerByContact,
}));

vi.mock("@/server/jobs/booking-side-effects", () => ({
  enqueueBookingCreatedSideEffects: mockEnqueueBookingCreatedSideEffects,
  safeBookingPayload: mockSafeBookingPayload,
}));

describe("POST /api/ops/bookings", () => {
  let POST: typeof import("@/app/api/ops/bookings/route").POST;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/ops/bookings/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    const authGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "staff@example.com" } },
      error: null,
    });

    mockGetRouteHandlerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: authGetUser,
      },
    });

    mockGetServiceSupabaseClient.mockReturnValue({});
    mockRequireMembershipForRestaurant.mockResolvedValue(
      makeRestaurantMembership({ restaurant_id: RESTAURANT_ID, user_id: "user-1" })
    );

    mockUpsertCustomer.mockResolvedValue({ id: "cust-1" });
    mockFetchBookingsForContact.mockResolvedValue([]);
    mockGenerateUniqueBookingReference.mockResolvedValue("BOOKREF123");
    mockInsertBookingRecord.mockResolvedValue(
      makeBookingRecord({
        id: "booking-1",
        restaurant_id: RESTAURANT_ID,
        reference: "BOOKREF123",
        customer_email: "alex@example.com",
      })
    );
    mockEnqueueBookingCreatedSideEffects.mockResolvedValue({ queued: true });
    mockSafeBookingPayload.mockImplementation((value) => value);
  });

  function createRequest(body: unknown, headersInit: Record<string, string> = {}) {
    const headers = new Headers({ "Content-Type": "application/json", ...headersInit });

    return {
      headers,
      json: async () => body,
    } as unknown as Request;
  }

  it("returns 400 when payload fails validation", async () => {
    const request = createRequest({});
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid payload");
  });

  it("returns 403 when membership validation fails", async () => {
    mockRequireMembershipForRestaurant.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { code: "MEMBERSHIP_NOT_FOUND" })
    );

    const request = createRequest({
      restaurantId: RESTAURANT_ID,
      date: "2025-10-10",
      time: "18:00",
      party: 2,
      bookingType: "dinner",
      seating: "indoor",
      notes: null,
      name: "Alex Rider",
      email: "alex@example.com",
      phone: null,
      marketingOptIn: false,
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
    expect(mockInsertBookingRecord).not.toHaveBeenCalled();
  });

  it("creates a walk-in booking and enqueues side effects", async () => {
    const payload = {
      restaurantId: RESTAURANT_ID,
      date: "2025-10-10",
      time: "18:00",
      party: 2,
      bookingType: "dinner",
      seating: "indoor",
      notes: "Anniversary",
      name: "Alex Rider",
      email: "alex@example.com",
      phone: null,
      marketingOptIn: true,
    };

    const request = createRequest(payload, { "user-agent": "vitest" });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);

    const upsertArgs = mockUpsertCustomer.mock.calls[0];
    expect(upsertArgs).toBeDefined();
    expect(upsertArgs[1]).toMatchObject({
      restaurantId: RESTAURANT_ID,
      email: payload.email,
      name: payload.name,
      marketingOptIn: true,
    });
    expect((upsertArgs[1] as { phone: string }).phone).toMatch(/^000-/);

    expect(mockGenerateUniqueBookingReference).toHaveBeenCalled();
    expect(mockInsertBookingRecord).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      restaurant_id: RESTAURANT_ID,
      booking_date: payload.date,
      start_time: payload.time,
      party_size: payload.party,
      reference: "BOOKREF123",
    }));

    expect(mockEnqueueBookingCreatedSideEffects).toHaveBeenCalled();
    const enqueueArgs = mockEnqueueBookingCreatedSideEffects.mock.calls[0]?.[0];
    expect(enqueueArgs).toBeDefined();
    expect(enqueueArgs).toMatchObject({
      restaurantId: RESTAURANT_ID,
      idempotencyKey: null,
    });
    expect(enqueueArgs.booking).toMatchObject({ id: "booking-1" });

    expect(data.booking.id).toBe("booking-1");
    expect(Array.isArray(data.bookings)).toBe(true);
    expect(data.idempotencyKey).toBeNull();
    expect(typeof data.clientRequestId).toBe("string");
  });

  it("deduplicates requests with the same idempotency key", async () => {
    const existing = makeBookingRecord({
      id: "booking-existing",
      restaurant_id: RESTAURANT_ID,
      reference: "BOOKEXIST",
      customer_email: "walkin@system.local",
    });

    const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const eqSecond = vi.fn(() => ({ maybeSingle }));
    const eqFirst = vi.fn(() => ({ eq: eqSecond }));
    const select = vi.fn(() => ({ eq: eqFirst }));
    const from = vi.fn(() => ({ select }));
    mockGetServiceSupabaseClient.mockReturnValue({ from });

    mockFetchBookingsForContact.mockResolvedValue([existing]);

    const payload = {
      restaurantId: RESTAURANT_ID,
      date: "2025-10-10",
      time: "18:00",
      party: 2,
      bookingType: "dinner",
      seating: "indoor",
      notes: null,
      name: "Alex Rider",
      email: null,
      phone: null,
      marketingOptIn: false,
    };

    const request = createRequest(payload, { "Idempotency-Key": "00000000-0000-0000-0000-000000000000" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockInsertBookingRecord).not.toHaveBeenCalled();

    expect(data.duplicate).toBe(true);
    expect(data.booking.id).toBe("booking-existing");
    expect(data.idempotencyKey).toBe("00000000-0000-0000-0000-000000000000");
  });
});
