import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockedSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
  },
};

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => mockedSupabase as any),
  getServiceSupabaseClient: vi.fn(() => ({})),
}));

const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("@/server/team/access", () => ({
  fetchUserMemberships: vi.fn(async () => [
    {
      restaurant_id: RESTAURANT_ID,
      restaurants: { name: "Awesome Bistro" },
    },
  ]),
}));

vi.mock("@/server/ops/customers", () => ({
  getAllCustomersWithProfiles: vi.fn(async () => [
    {
      id: "cust-1",
      restaurantId: RESTAURANT_ID,
      name: "Alex Rider",
      email: "alex@example.com",
      phone: "+441234567890",
      marketingOptIn: true,
      createdAt: "2025-01-01T10:00:00Z",
      updatedAt: "2025-01-01T10:00:00Z",
      firstBookingAt: "2025-01-05T10:00:00Z",
      lastBookingAt: "2025-02-02T19:00:00Z",
      totalBookings: 5,
      totalCovers: 12,
      totalCancellations: 1,
    },
  ]),
}));

const { GET } = await import("@/app/api/ops/customers/export/route");

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/ops/customers/export", () => {
  it("returns a CSV response with BOM and expected filename", async () => {
    const request = new NextRequest(`http://localhost/api/ops/customers/export?restaurantId=${RESTAURANT_ID}`);

    const response = await GET(request);
    expect(response.status).toBe(200);

    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toMatch(/filename="customers-awesome-bistro-\d{4}-\d{2}-\d{2}.csv"/i);

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
    const body = new TextDecoder().decode(arrayBuffer);
    expect(body).toContain("Name,Email,Phone,Total Bookings,Total Covers,Total Cancellations,First Booking,Last Booking,Marketing Opt-in");
    expect(body).toContain("Alex Rider");
  });
});
