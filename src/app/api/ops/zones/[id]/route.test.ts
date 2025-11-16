process.env.BASE_URL ??= "http://localhost:3000";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, PATCH } from "./route";

const getRouteHandlerSupabaseClientMock = vi.fn();

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
}));

const RESTAURANT_ID = "123e4567-e89b-12d3-a456-426614174000";
const ZONE_ID = "11111111-1111-4111-8111-111111111111";

type ZoneRecord = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SupabaseStubOptions = {
  initialZones?: ZoneRecord[];
  deleteError?: { code?: string; message: string } | null;
};

function createSupabaseStub(options: SupabaseStubOptions = {}) {
  const zones: ZoneRecord[] = options.initialZones?.map((zone) => ({ ...zone })) ?? [
    {
      id: ZONE_ID,
      restaurant_id: RESTAURANT_ID,
      name: "Main",
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (table: string) => {
      if (table === "restaurant_memberships") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: "owner" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "table_inventory") {
        return {
          select: () => ({
            eq: () => ({
              select: async () => ({ data: [{ id: "table-1" }], error: null }),
            }),
          }),
        };
      }

      if (table === "zones") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              order: () => ({
                order: () =>
                  Promise.resolve({
                    data: zones.filter((zone) => zone.restaurant_id === value),
                    error: null,
                  }),
              }),
              maybeSingle: async () => ({
                data: zones.find((zone) => zone.id === value) ?? null,
                error: null,
              }),
            }),
          }),
          update: (payload: { name?: string | null; sort_order?: number | null }) => ({
            eq: (_column: string, zoneId: string) => ({
              select: () => ({
                single: async () => {
                  const index = zones.findIndex((zone) => zone.id === zoneId);
                  if (index === -1) {
                    return { data: null, error: { message: "not found" } };
                  }
                  zones[index] = {
                    ...zones[index],
                    name: payload.name ?? zones[index].name,
                    sort_order: payload.sort_order ?? zones[index].sort_order,
                    updated_at: new Date().toISOString(),
                  };
                  return { data: zones[index], error: null };
                },
              }),
            }),
          }),
          delete: () => ({
            eq: (_column: string, zoneId: string) => {
              if (options.deleteError) {
                return Promise.resolve({ error: options.deleteError });
              }
              const index = zones.findIndex((zone) => zone.id === zoneId);
              if (index !== -1) {
                zones.splice(index, 1);
              }
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return supabase;
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

describe("/api/ops/zones/[id]", () => {
  it("updates a zone", async () => {
    const supabase = createSupabaseStub();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await PATCH(
      createRequest(`http://localhost/api/ops/zones/${ZONE_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Patio" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: ZONE_ID }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.zone).toMatchObject({ id: ZONE_ID, name: "Patio" });
  });

  it("returns 409 when deleting a zone in use", async () => {
    const supabase = createSupabaseStub({ deleteError: { code: "23503", message: "in use" } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await DELETE(
      createRequest(`http://localhost/api/ops/zones/${ZONE_ID}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: ZONE_ID }) },
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("Zone is still in use by existing tables");
  });
});
