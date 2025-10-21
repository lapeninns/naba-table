process.env.BASE_URL ??= "http://localhost:3000";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const getRouteHandlerSupabaseClientMock = vi.fn();

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
}));

const RESTAURANT_ID = "123e4567-e89b-12d3-a456-426614174000";
const DEFAULT_ZONE_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_ZONE_ID = "22222222-2222-4222-8222-222222222222";

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
  membershipRole?: string | null;
  membershipError?: { message: string } | null;
  selectError?: { message: string } | null;
  insertError?: { message: string } | null;
};

function createSupabaseStub(options: SupabaseStubOptions = {}) {
  const zones: ZoneRecord[] = options.initialZones?.map((zone) => ({ ...zone })) ?? [
    {
      id: DEFAULT_ZONE_ID,
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

      if (table === "zones") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              order: () => ({
                order: () =>
                  Promise.resolve({
                    data: zones.filter((zone) => zone.restaurant_id === value),
                    error: options.selectError ?? null,
                  }),
              }),
              maybeSingle: async () => ({
                data: zones.find((zone) => zone.id === value) ?? null,
                error: null,
              }),
            }),
          }),
          insert: (payload: { restaurant_id: string; name?: string | null; sort_order?: number | null }) => ({
            select: () => ({
              single: async () => {
                if (options.insertError) {
                  return { data: null, error: options.insertError };
                }

                const record: ZoneRecord = {
                  id: CREATED_ZONE_ID,
                  restaurant_id: payload.restaurant_id,
                  name: payload.name ?? "",
                  sort_order: payload.sort_order ?? 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                zones.push(record);
                return { data: record, error: null };
              },
            }),
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

describe("/api/ops/zones", () => {
  it("returns zones for a restaurant", async () => {
    const supabase = createSupabaseStub();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(createRequest(`/api/ops/zones?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.zones).toHaveLength(1);
    expect(body.zones[0]).toMatchObject({ id: DEFAULT_ZONE_ID, name: "Main" });
  });

  it("creates a zone", async () => {
    const supabase = createSupabaseStub({ initialZones: [] });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await POST(
      createRequest(`/api/ops/zones`, {
        method: "POST",
        body: JSON.stringify({ restaurantId: RESTAURANT_ID, name: "Patio", sortOrder: 5 }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.zone).toMatchObject({ id: CREATED_ZONE_ID, name: "Patio", sort_order: 5 });
  });
});
