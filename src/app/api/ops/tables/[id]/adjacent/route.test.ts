process.env.BASE_URL ??= "http://localhost:3000";

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { GET, PUT } from "./route";

const getRouteHandlerSupabaseClientMock = vi.fn();

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
}));

const TABLE_ID = "11111111-1111-4111-8111-111111111111";
const ADJACENT_ID = "22222222-2222-4222-8222-222222222222";
const ADJACENT_ID_2 = "33333333-3333-4333-8333-333333333333";

function createAuthStub(userId = "user-1") {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    }),
  };
}

describe("/api/ops/tables/[id]/adjacent", () => {
  it("returns adjacency list for a table", async () => {
    const tableChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { restaurant_id: "rest-1" }, error: null }),
    };
    const membershipChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
    };
    const adjacencyChain = {
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [{ table_b: ADJACENT_ID }, { table_b: ADJACENT_ID_2 }], error: null }),
      }),
    };

    const supabase = {
      auth: createAuthStub(),
      from: vi.fn((table: string) => {
        switch (table) {
          case "table_inventory":
            return { select: vi.fn().mockReturnValue(tableChain) };
          case "restaurant_memberships":
            return { select: vi.fn().mockReturnValue(membershipChain) };
          case "table_adjacencies":
            return { select: vi.fn().mockReturnValue(adjacencyChain) };
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };

    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(new NextRequest("http://localhost/api/ops/tables/abc/adjacent"), {
      params: Promise.resolve({ id: TABLE_ID }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      tableId: TABLE_ID,
      adjacentIds: [ADJACENT_ID, ADJACENT_ID_2],
    });
  });

  it("prevents adjacency across zones", async () => {
    const tableChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: TABLE_ID, restaurant_id: "rest-1", zone_id: "zone-1" },
        error: null,
      }),
    };
    const membershipChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
    };

    const supabase = {
      auth: createAuthStub(),
      from: vi.fn((table: string) => {
        switch (table) {
          case "table_inventory":
            return {
              select: vi.fn((columns: string) => {
                if (columns.includes("zone_id") && columns.includes("restaurant_id") && !columns.includes("active")) {
                  return tableChain;
                }
                return {
                  in: vi
                    .fn()
                    .mockResolvedValue({
                      data: [
                        { id: ADJACENT_ID, restaurant_id: "rest-1", zone_id: "zone-2", active: true },
                      ],
                      error: null,
                    }),
                };
              }),
            };
          case "restaurant_memberships":
            return { select: vi.fn().mockReturnValue(membershipChain) };
          case "table_adjacencies":
            return {
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
              insert: vi.fn(),
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };

    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const request = new NextRequest(`http://localhost/api/ops/tables/${TABLE_ID}/adjacent`, {
      method: "PUT",
      body: JSON.stringify({ adjacentIds: [ADJACENT_ID] }),
      headers: { "Content-Type": "application/json" },
      // @ts-expect-error duplex is required for request bodies in Node fetch impl
      duplex: "half",
    });

    const response = await PUT(request, { params: Promise.resolve({ id: TABLE_ID }) });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Adjacency requires tables to be in the same zone");
  });

  it("writes adjacency pairs symmetrically", async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    const tableChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: TABLE_ID, restaurant_id: "rest-1", zone_id: "zone-1" },
        error: null,
      }),
    };
    const membershipChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
    };

    const supabase = {
      auth: createAuthStub(),
      from: vi.fn((table: string) => {
        switch (table) {
          case "table_inventory":
            return {
              select: vi.fn((columns: string) => {
                if (columns.includes("active")) {
                  return {
                    in: vi.fn().mockResolvedValue({
                      data: [
                        { id: ADJACENT_ID, restaurant_id: "rest-1", zone_id: "zone-1", active: true },
                      ],
                      error: null,
                    }),
                  };
                }
                return tableChain;
              }),
            };
          case "restaurant_memberships":
            return { select: vi.fn().mockReturnValue(membershipChain) };
          case "table_adjacencies":
            return {
              delete: vi.fn().mockReturnValue({
                eq: deleteEq,
              }),
              insert: insertMock,
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [{ table_b: ADJACENT_ID }],
                    error: null,
                  }),
                }),
              }),
            };
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };

    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const request = new NextRequest(`http://localhost/api/ops/tables/${TABLE_ID}/adjacent`, {
      method: "PUT",
      body: JSON.stringify({ adjacentIds: [ADJACENT_ID] }),
      headers: { "Content-Type": "application/json" },
      // @ts-expect-error duplex is required for request bodies in Node fetch impl
      duplex: "half",
    });

    const response = await PUT(request, { params: Promise.resolve({ id: TABLE_ID }) });
    expect(response.status).toBe(200);
    expect(deleteEq).toHaveBeenCalledWith("table_a", TABLE_ID);
    expect(insertMock).toHaveBeenCalledWith([
      { table_a: TABLE_ID, table_b: ADJACENT_ID },
    ]);
  });
});
