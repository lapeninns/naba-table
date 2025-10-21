process.env.BASE_URL ??= "http://localhost:3000";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "./route";

const getRouteHandlerSupabaseClientMock = vi.fn();

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
}));

const RESTAURANT_ID = "123e4567-e89b-12d3-a456-426614174000";

type SupabaseStubOptions = {
  initialCapacities?: number[];
  membershipRole?: string | null;
  membershipError?: { message: string } | null;
  selectError?: { message: string } | null;
  deleteError?: { code?: string; message: string } | null;
};

function createSupabaseStub(options: SupabaseStubOptions = {}) {
  const state = {
    capacities: [...(options.initialCapacities ?? [2, 4, 5, 7])],
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    from(table: string) {
      if (table === "restaurant_memberships") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data:
                    options.membershipRole === null
                      ? null
                      : { role: options.membershipRole ?? "owner" },
                  error: options.membershipError ?? null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "allowed_capacities") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: state.capacities.map((capacity) => ({ capacity })),
                  error: options.selectError ?? null,
                }),
            }),
          }),
          upsert: async (payload: Array<{ capacity: number }>) => {
            payload.forEach((item) => {
              if (!state.capacities.includes(item.capacity)) {
                state.capacities.push(item.capacity);
              }
            });
            state.capacities.sort((a, b) => a - b);
            return { data: payload, error: null };
          },
          delete: () => ({
            eq: () => ({
              in: async (values: number[]) => {
                if (options.deleteError) {
                  return { data: null, error: options.deleteError };
                }
                state.capacities = state.capacities.filter((value) => !values.includes(value));
                return { data: null, error: null };
              },
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function createRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

beforeEach(() => {
  getRouteHandlerSupabaseClientMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/ops/allowed-capacities", () => {
  it("returns allowed capacities for authorized staff", async () => {
    const supabase = createSupabaseStub({ initialCapacities: [2, 3, 6] });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(
      createRequest(`/api/ops/allowed-capacities?restaurantId=${RESTAURANT_ID}`),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ capacities: [2, 3, 6] });
  });

  it("adds a new capacity via PUT", async () => {
    const supabase = createSupabaseStub({ initialCapacities: [2, 4] });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await PUT(
      createRequest(`/api/ops/allowed-capacities`, {
        method: "PUT",
        body: JSON.stringify({ restaurantId: RESTAURANT_ID, capacities: [2, 4, 6] }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.capacities).toEqual([2, 4, 6]);
  });

  it("returns 409 when attempting to remove a capacity still in use", async () => {
    const supabase = createSupabaseStub({
      initialCapacities: [2, 4],
      deleteError: { code: "23503", message: "violates foreign key" },
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await PUT(
      createRequest(`/api/ops/allowed-capacities`, {
        method: "PUT",
        body: JSON.stringify({ restaurantId: RESTAURANT_ID, capacities: [2] }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.blockedCapacities).toEqual([4]);
  });
});
