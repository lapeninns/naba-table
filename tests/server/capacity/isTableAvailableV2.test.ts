process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

import { describe, expect, it, vi } from "vitest";

import { AssignTablesRpcError } from "@/server/capacity/holds";
import { getVenuePolicy, ServiceOverrunError } from "@/server/capacity/policy";

import type * as FeatureFlags from "@/server/feature-flags";

vi.mock("@/server/feature-flags", async () => {
  const actual = await vi.importActual<typeof FeatureFlags>("@/server/feature-flags");
  return {
    ...actual,
    isSelectorScoringEnabled: () => false,
    isOpsMetricsEnabled: () => false,
    isAllocatorAdjacencyRequired: () => true,
    getAllocatorAdjacencyMinPartySize: () => null,
    getAllocatorKMax: () => 3,
    getSelectorPlannerLimits: () => ({}),
    isHoldsEnabled: () => false,
    isCombinationPlannerEnabled: () => false,
  };
});

const { isTableAvailableV2, isTableAvailable } = await import("@/server/capacity/tables");

describe("isTableAvailableV2", () => {
  it("detects buffer collisions from existing assignments", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const client = {
      rpc,
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as const;
    const policy = getVenuePolicy();

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T19:30:00Z", 2, {
        client,
        policy,
      }),
    ).resolves.toBe(false);

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T20:00:00Z", 2, {
        client,
        policy,
      }),
    ).resolves.toBe(true);
  });

  it("ignores the excluded booking when checking availability", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = {
      rpc,
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as const;
    const policy = getVenuePolicy();

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T18:00:00Z", 2, {
        client,
        policy,
        excludeBookingId: "booking-edit",
      }),
    ).resolves.toBe(true);
  });
  it("throws ServiceOverrunError when fallback window would overrun service", async () => {
    const policy = getVenuePolicy({ timezone: "Europe/London" });
    const client = {
      rpc: vi.fn(),
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as const;

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T23:30:00+01:00", 2, {
        client,
        policy,
      }),
    ).rejects.toThrow(ServiceOverrunError);
  });

  it("throws AssignTablesRpcError when Supabase returns an error", async () => {
    const policy = getVenuePolicy();
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database offline", details: "timeout", hint: null, code: "P0001" },
      }),
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as const;

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T18:00:00Z", 2, {
        client,
        policy,
      }),
    ).rejects.toThrow(AssignTablesRpcError);
  });

  it("wraps availability errors with a stable AssignTablesRpcError message", async () => {
    const policy = getVenuePolicy();
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database offline", details: "timeout", hint: "retry", code: "P0001" },
      }),
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as const;

    await expect(
      isTableAvailable("table-1", "2025-10-26T18:00:00Z", 2, {
        client,
        policy,
      }),
    ).rejects.toMatchObject({
      message: "Failed to verify table availability",
      code: "TABLE_AVAILABILITY_QUERY_FAILED",
    });
  });
});
