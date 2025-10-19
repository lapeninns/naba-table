process.env.BASE_URL ??= "http://localhost:3000";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const isOpsMetricsEnabledMock = vi.fn(() => true);
const getRouteHandlerSupabaseClientMock = vi.fn();

vi.mock("@/server/feature-flags", () => ({
  isOpsMetricsEnabled: () => isOpsMetricsEnabledMock(),
}));

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
}));

const RESTAURANT_ID = "123e4567-e89b-12d3-a456-426614174001";

type SelectorEvent = {
  event_type: string;
  created_at: string;
  context: Record<string, any> | null;
};

type MetricsStubOptions = {
  events?: SelectorEvent[];
  eventsError?: { message: string } | null;
  membershipRole?: string | null;
  membershipError?: { message: string } | null;
};

function createSupabaseStub(options: MetricsStubOptions = {}) {
  const state = {
    events: options.events ?? [],
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-ops" } }, error: null }),
    },
    from(table: string) {
      if (table === "restaurant_memberships") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue(
                  options.membershipRole
                    ? { data: { role: options.membershipRole }, error: options.membershipError ?? null }
                    : { data: { role: "owner" }, error: options.membershipError ?? null },
                ),
              }),
            }),
          }),
        };
      }

      if (table === "observability_events") {
        return {
          select: () => ({
            eq: () => ({
              contains: () => ({
                gte: () => ({
                  lt: () => ({
                    order: () =>
                      Promise.resolve({
                        data: state.events,
                        error: options.eventsError ?? null,
                      }),
                  }),
                }),
              }),
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
  isOpsMetricsEnabledMock.mockReturnValue(true);
  getRouteHandlerSupabaseClientMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/ops/metrics/selector", () => {
  it("aggregates selector telemetry", async () => {
    const events: SelectorEvent[] = [
      {
        event_type: "capacity.selector.assignment",
        created_at: "2025-10-18T10:00:00Z",
        context: {
          restaurantId: RESTAURANT_ID,
          bookingId: "booking-1",
          partySize: 2,
          selected: { tableCount: 1, tableIds: ["A"], slack: 0 },
          topCandidates: [],
          durationMs: 120,
        },
      },
      {
        event_type: "capacity.selector.assignment",
        created_at: "2025-10-18T11:00:00Z",
        context: {
          restaurantId: RESTAURANT_ID,
          bookingId: "booking-2",
          partySize: 6,
          selected: { tableCount: 2, tableIds: ["B", "C"], slack: 1 },
          topCandidates: [],
          durationMs: 180,
        },
      },
      {
        event_type: "capacity.selector.skipped",
        created_at: "2025-10-18T12:00:00Z",
        context: {
          restaurantId: RESTAURANT_ID,
          bookingId: "booking-3",
          skipReason: "no_connected_capacity",
          durationMs: 50,
        },
      },
    ];

    const supabase = createSupabaseStub({ events });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(
      createRequest(`/api/ops/metrics/selector?restaurantId=${RESTAURANT_ID}&date=2025-10-18`),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary.assignmentsTotal).toBe(2);
    expect(body.summary.skippedTotal).toBe(1);
    expect(body.summary.mergeRate).toBeCloseTo(0.5, 4);
    expect(body.summary.avgOverage).toBeCloseTo(0.5, 4);
    expect(body.skipReasons).toContainEqual({ reason: 'no_connected_capacity', count: 1 });
    expect(body.samples.length).toBeGreaterThan(0);
  });

  it("returns 500 when telemetry query fails", async () => {
    const supabase = createSupabaseStub({ eventsError: { message: "query failed" } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(
      createRequest(`/api/ops/metrics/selector?restaurantId=${RESTAURANT_ID}`),
    );

    expect(response.status).toBe(500);
  });

  it("short-circuits when feature disabled", async () => {
    isOpsMetricsEnabledMock.mockReturnValueOnce(false);

    const response = await GET(
      createRequest(`/api/ops/metrics/selector?restaurantId=${RESTAURANT_ID}`),
    );

    expect(response.status).toBe(404);
  });
});
