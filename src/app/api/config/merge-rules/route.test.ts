process.env.BASE_URL ??= "http://localhost:3000";

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const getRouteHandlerSupabaseClientMock = vi.fn();

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
}));

describe("GET /api/config/merge-rules", () => {
  it("returns merge rules ordered by input capacities", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "rule-1",
                  from_a: 2,
                  from_b: 4,
                  to_capacity: 6,
                  enabled: true,
                  require_same_zone: true,
                  require_adjacency: true,
                  cross_category_merge: false,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };

    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(new NextRequest("http://localhost/api/config/merge-rules"));
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.rules).toEqual([
      {
        id: "rule-1",
        from: [2, 4],
        toCapacity: 6,
        enabled: true,
        requireSameZone: true,
        requireAdjacency: true,
        crossCategoryMerge: false,
      },
    ]);
  });

  it("returns 500 when query fails", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "boom" },
            }),
          }),
        }),
      }),
    };

    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(new NextRequest("http://localhost/api/config/merge-rules"));
    expect(response.status).toBe(500);
  });
});
