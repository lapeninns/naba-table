import { getServiceSupabaseClient } from "@/server/supabase";

import { AssignmentConflictError, AssignmentRepositoryError, AssignmentValidationError } from "./errors";

import type { AssignmentRepository } from "./repository";
import type {
  AssignmentCommitRequest,
  AssignmentCommitResponse,
  AssignmentRecord,
} from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

type PostgrestError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type AssignTablesAtomicRow = {
  table_id: string;
  start_at: string;
  end_at: string;
  merge_group_id: string | null;
  assignment_id?: string | null;
};

function extractUuids(value: string | null | undefined): string[] {
  if (!value) return [];
  const matches = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
  return matches ? matches.map((entry) => entry.toLowerCase()) : [];
}

function parseBlockingBookingId(message: string, details: string | null | undefined): string | undefined {
  const sources = [message, details ?? ""];
  for (const source of sources) {
    const match = source.match(/booking\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return undefined;
}

function buildConflictError(params: {
  error: PostgrestError;
  request: AssignmentCommitRequest;
}): AssignmentConflictError {
  const { error, request } = params;
  const conflictTables = new Set<string>();
  for (const tableId of request.plan.tableIds) {
    conflictTables.add(tableId.toLowerCase());
  }
  for (const uuid of extractUuids(error.message)) {
    conflictTables.add(uuid);
  }
  for (const uuid of extractUuids(error.details)) {
    conflictTables.add(uuid);
  }

  const blockingBookingId = parseBlockingBookingId(error.message ?? "", error.details);

  return new AssignmentConflictError(error.message ?? "Assignment conflict", {
    tableIds: Array.from(conflictTables),
    blockingBookingId,
    window: {
      start: request.plan.startAt,
      end: request.plan.endAt,
    },
    hint: error.hint ?? undefined,
    raw: {
      code: error.code,
      details: error.details,
      metadata: request.metadata ?? null,
    },
  });
}

function buildValidationError(params: {
  error: PostgrestError;
  request: AssignmentCommitRequest;
}): AssignmentValidationError {
  const { error, request } = params;
  return new AssignmentValidationError(error.message ?? "Assignment validation failed", {
    code: error.code,
    details: error.details,
    hint: error.hint,
    plan: {
      tableIds: request.plan.tableIds,
      startAt: request.plan.startAt,
      endAt: request.plan.endAt,
    },
    context: {
      bookingId: request.context.bookingId,
      restaurantId: request.context.restaurantId,
    },
  });
}

function translateSupabaseError(params: {
  error: PostgrestError;
  request: AssignmentCommitRequest;
}): never {
  const { error, request } = params;
  const code = (error.code ?? "").toUpperCase();
  const message = error.message ?? "assign_tables_atomic_v2 failed";
  const normalized = message.toLowerCase();

  if (normalized.includes("capacity_exceeded_post_assignment")) {
    throw buildConflictError({
      error: {
        ...error,
        message: "Capacity exceeded after assignment",
        hint: error.hint ?? "Release tables or adjust capacity overrides before retrying.",
      },
      request,
    });
  }

  if (
    code === "23505" ||
    code === "P0001" ||
    normalized.includes("duplicate") ||
    normalized.includes("overlap") ||
    normalized.includes("conflict")
  ) {
    throw buildConflictError({ error, request });
  }

  if (
    code === "23514" ||
    code === "23503" ||
    code === "23502" ||
    code === "22023" ||
    code === "22000" ||
    code === "P0002" ||
    code === "P0003" ||
    normalized.includes("requires at least one") ||
    normalized.includes("not assigned") ||
    normalized.includes("missing") ||
    normalized.includes("invalid")
  ) {
    throw buildValidationError({ error, request });
  }

  throw new AssignmentRepositoryError(message, error);
}

export class SupabaseAssignmentRepository implements AssignmentRepository {
  constructor(private readonly client: SupabaseClient = getServiceSupabaseClient()) {}

  async commitAssignment(request: AssignmentCommitRequest): Promise<AssignmentCommitResponse> {
    const { context, plan, idempotencyKey, actorId, shadow } = request;
    const supabase = this.client;

    if (!context.window) {
      throw new AssignmentValidationError("Assignment window not provided in context", { context });
    }

    const requireAdjacency = request.requireAdjacency ?? true;

    const payload = {
      p_booking_id: context.bookingId,
      p_table_ids: plan.tableIds,
      p_idempotency_key: idempotencyKey,
      p_require_adjacency: requireAdjacency,
      p_assigned_by: actorId ?? null,
      p_start_at: plan.startAt,
      p_end_at: plan.endAt,
    };

    const { data, error } = await supabase.rpc("assign_tables_atomic_v2", payload);

    if (error) {
      translateSupabaseError({ error, request });
    }

    const rows = (data ?? []) as AssignTablesAtomicRow[];
    const assignments: AssignmentRecord[] = rows.map((row) => ({
      tableId: row.table_id,
      startAt: row.start_at,
      endAt: row.end_at,
      mergeGroupId: row.merge_group_id ?? null,
      assignmentId: row.assignment_id ?? undefined,
    }));

    return {
      attemptId: `rpc-${plan.signature}`,
      assignments,
      mergeGroupId: assignments[0]?.mergeGroupId ?? null,
      shadow: shadow ?? false,
    };
  }
}

export class NoopAssignmentRepository implements AssignmentRepository {
  async commitAssignment(_request: AssignmentCommitRequest): Promise<AssignmentCommitResponse> {
    return {
      attemptId: "noop",
      assignments: [],
      mergeGroupId: null,
      shadow: true,
    };
  }
}
