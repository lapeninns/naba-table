import type { CandidateSummary } from "../telemetry";

export type AssignmentSource = "manual" | "auto";

export type AssignmentPlan = {
  /** Deterministic hash representing the candidate plan (tables + window + constraints). */
  signature: string;
  tableIds: string[];
  startAt: string;
  endAt: string;
  metadata?: Record<string, unknown>;
  candidate?: CandidateSummary;
};

export type AssignmentContext = {
  bookingId: string;
  restaurantId: string;
  partySize: number;
  zoneId?: string | null;
  serviceDate?: string | null;
  window?: {
    startAt: string;
    endAt: string;
  };
  holdId?: string | null;
};

export type AssignmentRecord = {
  tableId: string;
  startAt: string;
  endAt: string;
  mergeGroupId: string | null;
  assignmentId?: string;
};

export type AssignmentCommitRequest = {
  context: AssignmentContext;
  plan: AssignmentPlan;
  source: AssignmentSource;
  idempotencyKey: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  shadow?: boolean;
  requireAdjacency?: boolean;
};

export type AssignmentCommitResponse = {
  attemptId: string;
  assignments: AssignmentRecord[];
  mergeGroupId?: string | null;
  telemetryId?: string;
  shadow?: boolean;
};

export type AssignmentAttemptDiagnostics = {
  planSignature: string;
  candidateCount: number;
  generatedAt: string;
  skipped?: number;
  conflictDetails?: Record<string, unknown>;
};
