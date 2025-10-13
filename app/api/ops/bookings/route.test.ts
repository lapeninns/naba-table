import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";
import { opsWalkInBookingSchema } from "./schema";

const getUserMock = vi.fn();
const getRouteHandlerSupabaseClientMock = vi.fn(async () => ({
  auth: {
    getUser: getUserMock,
  },
}));
const getServiceSupabaseClientMock = vi.fn();

const upsertCustomerMock = vi.fn();
const fetchUserMembershipsMock = vi.fn();
const requireMembershipForRestaurantMock = vi.fn();
const generateUniqueBookingReferenceMock = vi.fn();
const insertBookingRecordMock = vi.fn();
const fetchBookingsForContactMock = vi.fn();
const enqueueBookingCreatedSideEffectsMock = vi.fn();
const consumeRateLimitMock = vi.fn();
const recordObservabilityEventMock = vi.fn();

const RESTAURANT_ID = "123e4567-e89b-12d3-a456-426614174000";

function createQueryStub(result: { data: unknown; count?: number | null; error?: unknown }) {
  const stub = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data: result.data,
      count: result.count ?? null,
      error: result.error ?? null,
    }),
  };
  return stub;
}

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
  getServiceSupabaseClient: () => getServiceSupabaseClientMock(),
}));

vi.mock("@/server/team/access", () => ({
  fetchUserMemberships: (...args: unknown[]) => fetchUserMembershipsMock(...args),
  requireMembershipForRestaurant: (...args: unknown[]) => requireMembershipForRestaurantMock(...args),
}));

vi.mock("@/server/customers", () => ({
  upsertCustomer: (...args: unknown[]) => upsertCustomerMock(...args),
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
}));

vi.mock("@/server/bookings", () => ({
  deriveEndTime: (start: string) => start,
  fetchBookingsForContact: (...args: unknown[]) => fetchBookingsForContactMock(...args),
  generateUniqueBookingReference: (...args: unknown[]) => generateUniqueBookingReferenceMock(...args),
  inferMealTypeFromTime: () => "dinner",
  insertBookingRecord: (...args: unknown[]) => insertBookingRecordMock(...args),
}));

vi.mock("@/server/jobs/booking-side-effects", () => ({
  enqueueBookingCreatedSideEffects: (...args: unknown[]) => enqueueBookingCreatedSideEffectsMock(...args),
  safeBookingPayload: (record: unknown) => record,
}));

vi.mock("@/server/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimitMock(...args),
}));

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: (...args: unknown[]) => recordObservabilityEventMock(...args),
}));

describe("POST /api/ops/bookings", () => {
  beforeEach(() => {
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60_000,
      source: "memory",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("accepts optional contact fields in schema", () => {
    const result = opsWalkInBookingSchema.safeParse({
      restaurantId: RESTAURANT_ID,
      date: "2025-05-01",
      time: "18:00",
      party: 2,
      bookingType: "dinner",
      seating: "indoor",
      notes: null,
      name: "Walk In",
      email: "",
      phone: "",
      marketingOptIn: false,
    });

    expect(result.success).toBe(true);
  });

  it("creates a walk-in booking without contact info", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "staff@example.com" } },
      error: null,
    });
    requireMembershipForRestaurantMock.mockResolvedValue({});
    upsertCustomerMock.mockResolvedValue({ id: "customer-1" });
    generateUniqueBookingReferenceMock.mockResolvedValue("OPS123");

    const createdAt = new Date().toISOString();
    const bookingRecord = {
      id: "booking-1",
      restaurant_id: RESTAURANT_ID,
      customer_id: "customer-1",
      booking_date: "2025-05-01",
      start_time: "18:00",
      end_time: "18:00",
      reference: "OPS123",
      party_size: 2,
      booking_type: "dinner",
      seating_preference: "indoor",
      status: "confirmed",
      customer_name: "Walk In",
      customer_email: "",
      customer_phone: "",
      notes: null,
      marketing_opt_in: false,
      source: "system",
      client_request_id: "uuid-test",
      idempotency_key: null,
      pending_ref: null,
      details: {
        channel: "ops.walkin",
      },
      created_at: createdAt,
      updated_at: createdAt,
    } as const;

    insertBookingRecordMock.mockResolvedValue(bookingRecord);
    fetchBookingsForContactMock.mockResolvedValue([bookingRecord]);

    const payload = {
      restaurantId: RESTAURANT_ID,
      date: "2025-05-01",
      time: "18:00",
      party: 2,
      bookingType: "dinner",
      seating: "indoor",
      notes: null,
      name: "Walk In",
      marketingOptIn: false,
    };

    const schemaSpy = vi
      .spyOn(opsWalkInBookingSchema, 'parse')
      .mockReturnValue(payload as any);

    getServiceSupabaseClientMock.mockReturnValue({});

    const request = new NextRequest("http://localhost/api/ops/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "user-agent": "vitest",
      },
      // @ts-expect-error duplex is required in Node fetch for request bodies
      duplex: "half",
    });

    const response = await POST(request);

    const json = await response.json();
    expect(response.status).toBe(201);

    expect(requireMembershipForRestaurantMock).toHaveBeenCalledWith({
      userId: "user-1",
      restaurantId: RESTAURANT_ID,
    });
    expect(upsertCustomerMock).toHaveBeenCalled();
    expect(insertBookingRecordMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      source: "system",
      customer_email: "",
      customer_phone: "",
    }));
    expect(fetchBookingsForContactMock).toHaveBeenCalled();
    expect(enqueueBookingCreatedSideEffectsMock).toHaveBeenCalled();
    expect(json.booking).toEqual(bookingRecord);
    schemaSpy.mockRestore();
  });

  it("rejects unauthenticated requests", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const request = new NextRequest("http://localhost/api/ops/bookings", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
      // @ts-expect-error duplex is required in Node fetch for request bodies
      duplex: "half",
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 429 when rate limit exceeded", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "staff@example.com" } }, error: null });
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      limit: 60,
      remaining: 0,
      resetAt: Date.now() + 5000,
      source: "memory",
    });

    const request = new NextRequest("http://localhost/api/ops/bookings", {
      method: "POST",
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        date: "2025-05-01",
        time: "18:00",
        party: 2,
        bookingType: "dinner",
        seating: "indoor",
        notes: null,
        name: "Walk In",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      // @ts-expect-error duplex is required in Node fetch for request bodies
      duplex: "half",
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ops_bookings.rate_limited",
      }),
    );
  });
});

describe("GET /api/ops/bookings", () => {
  beforeEach(() => {
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 120,
      remaining: 119,
      resetAt: Date.now() + 60_000,
      source: "memory",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const request = new NextRequest("http://localhost/api/ops/bookings");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns empty list when user has no memberships", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "staff@example.com" } }, error: null });
    fetchUserMembershipsMock.mockResolvedValue([]);
    const request = new NextRequest("http://localhost/api/ops/bookings?page=1&pageSize=5");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.items).toEqual([]);
    expect(json.pageInfo.total).toBe(0);
    expect(json.pageInfo.hasNext).toBe(false);
  });

  it("lists bookings for restaurants the user belongs to", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "staff@example.com" } }, error: null });
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID }]);

    const queryStub = createQueryStub({
      data: [
        {
          id: "booking-1",
          restaurant_id: RESTAURANT_ID,
          party_size: 2,
          status: "confirmed",
          start_at: "2025-05-01T18:00:00.000Z",
          end_at: "2025-05-01T19:30:00.000Z",
          booking_date: "2025-05-01",
          start_time: "18:00",
          end_time: "19:30",
          notes: null,
          restaurants: { name: "Sajilo Reserve" },
        },
      ],
      count: 1,
    });

    const fromMock = vi.fn(() => queryStub);
    getServiceSupabaseClientMock.mockReturnValue({ from: fromMock });

    const request = new NextRequest(`http://localhost/api/ops/bookings?restaurantId=${RESTAURANT_ID}&page=1&pageSize=10`);
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("booking-1");
    expect(json.items[0].restaurantId).toBe(RESTAURANT_ID);
    expect(json.items[0].restaurantName).toBe("Sajilo Reserve");
    expect(queryStub.range).toHaveBeenCalledWith(0, 9);
  });

  it("returns 429 when rate limit exceeded", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "staff@example.com" } }, error: null });
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      limit: 120,
      remaining: 0,
      resetAt: Date.now() + 5_000,
      source: "memory",
    });

    const request = new NextRequest(`http://localhost/api/ops/bookings?restaurantId=${RESTAURANT_ID}&page=1&pageSize=10`);
    const response = await GET(request);
    expect(response.status).toBe(429);
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ops_bookings.rate_limited",
      }),
    );
  });
});
