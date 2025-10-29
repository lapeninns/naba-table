import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/capacity/telemetry", () => ({
  emitHoldCreated: vi.fn(),
  emitHoldConfirmed: vi.fn(),
  emitHoldExpired: vi.fn(),
  emitHoldStrictConflict: vi.fn(),
  emitRpcConflict: vi.fn(),
}));

const REQUIRED_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

type ChainableQuery<T> = {
  eq(): ChainableQuery<T>;
  gt(): ChainableQuery<T>;
  lt(): ChainableQuery<T>;
  then: Promise<T>["then"];
  catch: Promise<T>["catch"];
  finally: Promise<T>["finally"];
};

function createChainableQuery<T>(result: T): ChainableQuery<T> {
  const promise = Promise.resolve(result);
  const chain: ChainableQuery<T> = {
    eq: () => chain,
    gt: () => chain,
    lt: () => chain,
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return chain;
}

type SupabaseHoldRow = Record<string, unknown>;

function createSupabaseClientWithConflicts(conflicts: SupabaseHoldRow[]) {
  return {
    from(table: string) {
      if (table === "table_holds") {
        return {
          select: () =>
            createChainableQuery({
              data: conflicts,
              error: null,
            }),
        };
      }
      if (table === "table_hold_members") {
        return {
          insert: () => Promise.resolve({ data: [], error: null }),
        };
      }
      return {
        insert: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

describe("createTableHold strict conflicts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    for (const [key, value] of Object.entries(REQUIRED_ENV)) {
      process.env[key] = value;
    }
  });

  it("throws when strict conflicts are present", async () => {
    const telemetry = await import("@/server/capacity/telemetry");
    const holdsModule = await import("@/server/capacity/holds");
    const featureFlagsModule = await import("@/server/feature-flags");

    vi.spyOn(featureFlagsModule, "isHoldStrictConflictsEnabled").mockReturnValue(true);

    const supabaseClient = createSupabaseClientWithConflicts([
      {
        id: "existing-hold",
        booking_id: "other-booking",
        start_at: "2025-01-20T18:00:00.000Z",
        end_at: "2025-01-20T20:00:00.000Z",
        expires_at: "2025-01-20T18:10:00.000Z",
        table_hold_members: [{ table_id: "table-1" }],
      },
    ]);

    await expect(
      holdsModule.createTableHold({
        bookingId: "new-booking",
        restaurantId: "restaurant-1",
        zoneId: "zone-1",
        tableIds: ["table-1"],
        startAt: "2025-01-20T18:00:00.000Z",
        endAt: "2025-01-20T20:00:00.000Z",
        expiresAt: "2025-01-20T18:05:00.000Z",
        client: supabaseClient,
      }),
    ).rejects.toThrow(holdsModule.HoldConflictError);

    expect(telemetry.emitHoldStrictConflict).toHaveBeenCalledTimes(1);
  });
});
