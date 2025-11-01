import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AssignmentConflictError,
  AssignmentOrchestrator,
  AssignmentRepositoryError,
  AssignmentValidationError,
  SupabaseAssignmentRepository,
} from "@/server/capacity/v2";
import * as featureFlags from "@/server/feature-flags";

type RpcPayload = Record<string, unknown>;

type FakeRpcCall = {
  name: string;
  payload: RpcPayload;
};

const baseRequest = {
  context: {
    bookingId: "booking-1",
    restaurantId: "restaurant-1",
    partySize: 4,
    serviceDate: "2025-01-01",
    window: {
      startAt: "2025-01-01T18:00:00.000Z",
      endAt: "2025-01-01T19:20:00.000Z",
    },
  },
  plan: {
    signature: "plan-1",
    tableIds: ["table-1", "table-2"],
    startAt: "2025-01-01T18:00:00.000Z",
    endAt: "2025-01-01T19:20:00.000Z",
  },
  source: "manual" as const,
  idempotencyKey: "key-1",
} as const;

describe("SupabaseAssignmentRepository", () => {
  let rpcCalls: FakeRpcCall[];
  const fakeClient = {
    rpc: vi.fn(async (name: string, payload: RpcPayload) => {
      rpcCalls.push({ name, payload });
 
      return { data: [], error: null };
    }),
  };

  beforeEach(() => {
    rpcCalls = [];
    fakeClient.rpc.mockClear();
  });

  it("returns assignments when Supabase succeeds", async () => {
    fakeClient.rpc.mockResolvedValueOnce({
      data: [
        {
          table_id: "table-1",
          start_at: "2025-01-01T18:00:00.000Z",
          end_at: "2025-01-01T19:20:00.000Z",
          merge_group_id: "merge-1",
          assignment_id: "assign-1",
        },
      ],
      error: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new SupabaseAssignmentRepository(fakeClient as any);
    const response = await repository.commitAssignment({ ...baseRequest });

  expect(fakeClient.rpc).toHaveBeenCalledWith("assign_tables_atomic_v2", {
    p_booking_id: "booking-1",
    p_table_ids: ["table-1", "table-2"],
    p_idempotency_key: "key-1",
    p_require_adjacency: true,
    p_assigned_by: null,
    p_start_at: "2025-01-01T18:00:00.000Z",
    p_end_at: "2025-01-01T19:20:00.000Z",
  });
    expect(response.assignments).toHaveLength(1);
    expect(response.assignments[0]?.tableId).toBe("table-1");
    expect(response.mergeGroupId).toBe("merge-1");
  });

  it("throws AssignmentConflictError for overlap/duplicate violations", async () => {
    fakeClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new SupabaseAssignmentRepository(fakeClient as any);
    await expect(repository.commitAssignment({ ...baseRequest })).rejects.toBeInstanceOf(AssignmentConflictError);
  });

  it("throws AssignmentValidationError for invalid inputs", async () => {
    fakeClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "Tables must be adjacent" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new SupabaseAssignmentRepository(fakeClient as any);
    await expect(repository.commitAssignment({ ...baseRequest })).rejects.toBeInstanceOf(AssignmentValidationError);
  });

  it("wraps unexpected errors as AssignmentRepositoryError", async () => {
    fakeClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "unexpected failure" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new SupabaseAssignmentRepository(fakeClient as any);
    await expect(repository.commitAssignment({ ...baseRequest })).rejects.toBeInstanceOf(AssignmentRepositoryError);
  });

  it("treats missing relation (42P01) as AssignmentRepositoryError", async () => {
    fakeClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01", message: 'relation "public.restaurant_capacity_rules" does not exist' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new SupabaseAssignmentRepository(fakeClient as any);
    await expect(repository.commitAssignment({ ...baseRequest })).rejects.toBeInstanceOf(AssignmentRepositoryError);
  });
});

describe("AssignmentOrchestrator", () => {
  const mockRepository = {
    commitAssignment: vi.fn(),
  };

  beforeEach(() => {
    mockRepository.commitAssignment.mockReset();
    vi.spyOn(featureFlags, "isAllocatorV2Enabled").mockReturnValue(true);
    vi.spyOn(featureFlags, "isAllocatorV2ShadowMode").mockReturnValue(false);
    vi.spyOn(featureFlags, "isAllocatorV2ForceLegacy").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates commit to repository and forwards options", async () => {
    mockRepository.commitAssignment.mockResolvedValueOnce({
      attemptId: "test",
      assignments: [],
      mergeGroupId: null,
      shadow: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orchestrator = new AssignmentOrchestrator(mockRepository as any);
    await orchestrator.commitPlan(baseRequest.context, baseRequest.plan, {
      source: "manual",
      idempotencyKey: "key-1",
      requireAdjacency: false,
    });

    expect(mockRepository.commitAssignment).toHaveBeenCalledTimes(1);
    expect(mockRepository.commitAssignment.mock.calls[0]?.[0]).toMatchObject({
      source: "manual",
      idempotencyKey: "key-1",
      requireAdjacency: false,
    });
  });

  it("wraps unexpected repository errors", async () => {
    mockRepository.commitAssignment.mockRejectedValueOnce(new Error("boom"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orchestrator = new AssignmentOrchestrator(mockRepository as any);
    await expect(
      orchestrator.commitPlan(baseRequest.context, baseRequest.plan, {
        source: "manual",
        idempotencyKey: "key-1",
      }),
    ).rejects.toBeInstanceOf(AssignmentRepositoryError);
  });
});
