process.env.BASE_URL ??= "http://localhost:3000";

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const getRouteHandlerSupabaseClientMock = vi.fn();

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
}));

describe("GET /api/config/service-policy", () => {
  it("returns the first service policy row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        lunch_start: "12:00",
        lunch_end: "15:00",
        dinner_start: "17:00",
        dinner_end: "22:00",
        clean_buffer_minutes: 5,
        allow_after_hours: false,
      },
      error: null,
    });

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle,
          }),
        }),
      }),
    };

    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(new NextRequest("http://localhost/api/config/service-policy"));
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.policy).toEqual({
      lunch: { start: "12:00", end: "15:00" },
      dinner: { start: "17:00", end: "22:00" },
      cleanBufferMinutes: 5,
      allowAfterHours: false,
    });
  });

  it("returns 404 when no policy configured", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(new NextRequest("http://localhost/api/config/service-policy"));
    expect(response.status).toBe(404);
  });
});
