import { AssignTablesRpcError, type TableHold, type HoldConflictInfo } from "@/server/capacity/holds";

import type { ServiceKey } from "@/server/capacity/policy";
import type { CandidateSummary } from "@/server/capacity/telemetry";
import type { Tables, Database, Json } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DateTime } from "luxon";

export type DbClient = SupabaseClient<Database, "public">;

export type Table = {
  id: string;
  tableNumber: string;
  capacity: number;
  minPartySize?: number | null;
  maxPartySize?: number | null;
  section?: string | null;
  category?: Tables<"table_inventory">["category"] | string | null;
  seatingType?: Tables<"table_inventory">["seating_type"] | string | null;
  mobility?: Tables<"table_inventory">["mobility"] | string | null;
  zoneId: string;
  status?: Tables<"table_inventory">["status"] | string | null;
  active?: boolean | null;
  position?: Tables<"table_inventory">["position"] | null;
};

export type TableMatchParams = {
  partySize: number;
  requireAdjacency?: boolean;
  avoidTableIds?: string[];
  zoneId?: string | null;
};

export type TableAssignmentMember = {
  tableId: string;
  /** Empty string indicates caller should re-read assignments later (replication lag). */
  assignmentId: string;
  startAt: string;
  endAt: string;
  mergeGroupId?: string | null;
};

export type PolicyDriftKind = "policy" | "adjacency";

export type PolicyDriftDetails = {
  expectedHash?: string;
  actualHash?: string;
  adjacency?: {
    expectedEdges?: string[];
    actualEdges?: string[];
    expectedHash?: string | null;
    actualHash?: string | null;
  };
  zones?: {
    expected?: Json;
    actual?: Json;
  };
  raw?: Json;
};

export class PolicyDriftError extends AssignTablesRpcError {
  public readonly kind: PolicyDriftKind;
  public readonly driftDetails: PolicyDriftDetails;

  constructor(params: {
    message: string;
    kind: PolicyDriftKind;
    details: PolicyDriftDetails;
    hint?: string | null;
  }) {
    const serializedDetails = params.details ? JSON.stringify(params.details) : null;
    super({
      message: params.message,
      code: "POLICY_DRIFT",
      details: serializedDetails,
      hint: params.hint ?? "Refresh and revalidate selection before confirming.",
    });
    this.kind = params.kind;
    this.driftDetails = params.details;
    this.name = "PolicyDriftError";
  }
}

export type TableAssignmentGroup = {
  bookingId: string;
  tableIds: string[];
  assignments: TableAssignmentMember[];
};

export type ManualSelectionCheck = {
  id: "capacity" | "slack" | "zone" | "movable" | "adjacency" | "conflict" | "holds";
  status: "ok" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
};

export type ManualSelectionSummary = {
  tableCount: number;
  totalCapacity: number;
  slack: number;
  zoneId: string | null;
  tableNumbers: string[];
  partySize: number;
};

export type ManualValidationResult = {
  ok: boolean;
  summary: ManualSelectionSummary;
  checks: ManualSelectionCheck[];
  policyVersion?: string;
  slackBudget?: number;
};

export type ManualSelectionOptions = {
  bookingId: string;
  tableIds: string[];
  requireAdjacency?: boolean;
  excludeHoldId?: string | null;
  client?: DbClient;
};

export type ManualHoldOptions = ManualSelectionOptions & {
  createdBy: string;
  holdTtlSeconds?: number;
  holdExpiresAt?: string;
};

export type ManualHoldResult = {
  hold: TableHold | null;
  validation: ManualValidationResult;
};

export type QuoteTablesOptions = {
  bookingId: string;
  zoneId?: string | null;
  maxTables?: number;
  requireAdjacency?: boolean;
  avoidTables?: string[];
  holdTtlSeconds?: number;
  createdBy: string;
  client?: DbClient;
  signal?: AbortSignal;
};

export type QuotePlannerStats = {
  totalTables?: number;
  filteredTables?: number;
  generatedPlans?: number;
  alternatesGenerated?: number;
  skippedCandidates?: number;
  holdConflictSkips?: number;
  timePruned?: number;
  candidatesAfterTimePrune?: number;
  combinationEnabled?: boolean;
  requireAdjacency?: boolean;
  demandMultiplier?: number;
  plannerDurationMs?: number;
};

export type QuoteTablesResult = {
  hold: TableHold | null;
  candidate: CandidateSummary | null;
  alternates: CandidateSummary[];
  nextTimes: string[];
  reason?: string;
  skipped?: Array<{ candidate: CandidateSummary; reason: string; conflicts: HoldConflictInfo[] }>;
  metadata?: {
    usedFallback: boolean;
    fallbackService: ServiceKey | null;
    relaxedMinPartySize?: boolean;
    capacityOverflowFallback?: boolean;
  };
  plannerStats?: QuotePlannerStats | null;
};

export type ManualAssignmentConflict = {
  tableId: string;
  bookingId: string | null;
  startAt: string;
  endAt: string;
  source: "booking" | "hold";
};

export type ManualAssignmentContextHold = TableHold & {
  createdByName?: string | null;
  createdByEmail?: string | null;
  summary?: ManualSelectionSummary;
};

export type ManualAssignmentContext = {
  booking: Tables<"bookings">;
  tables: Table[];
  bookingAssignments: string[];
  holds: ManualAssignmentContextHold[];
  activeHold: ManualAssignmentContextHold | null;
  conflicts: ManualAssignmentConflict[];
  window: {
    startAt: string | null;
    endAt: string | null;
  };
  flags?: {
    holdsStrictConflicts: boolean;
    adjacencyRequired: boolean;
    adjacencyUndirected: boolean;
  };
  contextVersion?: string;
  /**
   * Optional breakdown of version components used to compute contextVersion.
   * Adds visibility into topology/policy changes that can invalidate a session.
   */
  versions?: {
    context?: string | null;
    policy?: string | null;
    window?: string | null;
    flags?: string | null;
    tables?: string | null;
    adjacency?: string | null;
    holds?: string | null;
    assignments?: string | null;
  };
  policyVersion?: string | null;
  serverNow?: string;
};

export type BookingWindow = {
  service: ServiceKey;
  durationMinutes: number;
  dining: {
    start: DateTime;
    end: DateTime;
  };
  block: {
    start: DateTime;
    end: DateTime;
  };
  clampedToServiceEnd: boolean;
};

export class ManualSelectionInputError extends Error {
  constructor(
    message: string,
    public readonly code: string = "MANUAL_SELECTION_INPUT_INVALID",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ManualSelectionInputError";
  }
}
