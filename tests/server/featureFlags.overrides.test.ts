import { beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  FEATURE_PLANNER_TIME_PRUNING_ENABLED: "false",
  FEATURE_HOLDS_STRICT_CONFLICTS_ENABLED: "false",
  FEATURE_ADJACENCY_QUERY_UNDIRECTED: "true",
  FEATURE_ALLOCATOR_SERVICE_FAIL_HARD: "false",
};

type SupabaseMockResponse = {
  data: Array<{ flag: string; value: boolean }> | null;
  error: { message: string } | null;
};

function mockSupabaseOverrides(response: SupabaseMockResponse) {
  const eqMock = vi.fn().mockResolvedValue(response);
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
  const fromMock = vi.fn().mockReturnValue({ select: selectMock });

  vi.doMock("@/server/supabase", () => ({
    getServiceSupabaseClient: () => ({
      from: fromMock,
    }),
  }));

  return { fromMock, selectMock, eqMock };
}

describe("feature flag overrides", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    for (const [key, value] of Object.entries(REQUIRED_ENV)) {
      process.env[key] = value;
    }
  });

  it("prefers remote override when available", async () => {
    mockSupabaseOverrides({
      data: [{ flag: "planner.time_pruning.enabled", value: true }],
      error: null,
    });

    const overrides = await import("@/server/feature-flags-overrides");
    const featureFlags = await import("@/server/feature-flags");

    overrides.clearFeatureFlagOverrideCache();
    await overrides.prefetchFeatureFlagOverrides();

    expect(featureFlags.isPlannerTimePruningEnabled()).toBe(true);
  });

  it("falls back to environment default when override missing", async () => {
    mockSupabaseOverrides({
      data: [],
      error: null,
    });

    const overrides = await import("@/server/feature-flags-overrides");
    const featureFlags = await import("@/server/feature-flags");

    overrides.clearFeatureFlagOverrideCache();
    await overrides.prefetchFeatureFlagOverrides();

    expect(featureFlags.isPlannerTimePruningEnabled()).toBe(false);
  });

  it("continues with defaults when override query fails", async () => {
    mockSupabaseOverrides({
      data: null,
      error: { message: "relation \"feature_flag_overrides\" does not exist" },
    });

    const overrides = await import("@/server/feature-flags-overrides");
    const featureFlags = await import("@/server/feature-flags");

    overrides.clearFeatureFlagOverrideCache();
    await overrides.prefetchFeatureFlagOverrides();

    expect(featureFlags.isPlannerTimePruningEnabled()).toBe(false);
  });
});
