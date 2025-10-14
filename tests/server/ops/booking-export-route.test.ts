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

const RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";

vi.mock("@/server/team/access", () => ({
  requireMembershipForRestaurant: vi.fn(async () => ({
    restaurant_id: RESTAURANT_ID,
    restaurants: { name: "Awesome Bistro" },
  })),
}));

vi.mock("@/server/ops/bookings", () => ({
  getTodayBookingsSummary: vi.fn(async () => ({
    date: "2025-02-01",
    timezone: "Europe/London",
    restaurantId: RESTAURANT_ID,
    totals: {
      total: 1,
      confirmed: 1,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: 1,
      covers: 2,
    },
    bookings: [
      {
        id: "booking-1",
        status: "confirmed",
        startTime: "18:30",
        endTime: "20:00",
        partySize: 2,
        customerName: "Alex Rider",
        customerEmail: "alex@example.com",
        customerPhone: "+441234567890",
        notes: "Allergy: peanuts",
        reference: "RES-123",
        details: null,
        source: "ops",
        loyaltyTier: "gold",
        loyaltyPoints: 120,
        profileNotes: "VIP guest",
        allergies: ["peanuts"],
        dietaryRestrictions: ["vegetarian"],
        seatingPreference: "Window",
        marketingOptIn: true,
      },
    ],
  })),
}));

const { GET } = await import("@/app/api/ops/bookings/export/route");

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/ops/bookings/export", () => {
  it("returns a CSV response with BOM and expected filename", async () => {
    const request = new NextRequest(
      `http://localhost/api/ops/bookings/export?restaurantId=${RESTAURANT_ID}&date=2025-02-01`,
    );

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");

    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toMatch(/filename="bookings-awesome-bistro-2025-02-01.csv"/i);

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);

    const body = new TextDecoder().decode(arrayBuffer);
    expect(body).toContain(
      "Service Time,Guest,Party Size,Status,Email,Phone,Reference,Source,Loyalty Tier,Loyalty Points,Allergies,Dietary Restrictions,Seating Preference,Marketing Opt-in,Profile Notes,Booking Notes",
    );
    expect(body).toContain("Alex Rider");
    expect(body).toContain("Yes");
  });
});
