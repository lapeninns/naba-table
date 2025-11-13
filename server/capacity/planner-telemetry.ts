import { recordObservabilityEvent } from "@/server/observability";

import type { PlannerReasonCategory } from "./planner-reason";
import type { ObservabilitySeverity } from "@/server/observability";
import type { Json } from "@/types/supabase";

export type PlannerStrategyContext = {
  requireAdjacency: boolean | null;
  maxTables: number | null;
};

export type PlannerInternalStats = {
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

export type PlannerQuoteTelemetryParams = {
  restaurantId: string;
  bookingId: string;
  durationMs: number;
  success: boolean;
  reason: string | null;
  reasonCode?: string | null;
  reasonCategory?: PlannerReasonCategory;
  strategy: PlannerStrategyContext;
  trigger: string;
  attemptIndex?: number;
  errorMessage?: string | null;
  source?: string;
  severity?: ObservabilitySeverity;
  extraContext?: Json;
  internalStats?: PlannerInternalStats | null;
};

export async function recordPlannerQuoteTelemetry(params: PlannerQuoteTelemetryParams): Promise<void> {
  const context: Record<string, Json> = {
    planner_duration_ms: params.durationMs,
    planner_success: params.success,
    planner_reason: params.reason,
    planner_strategy: {
      requireAdjacency: params.strategy.requireAdjacency,
      maxTables: params.strategy.maxTables,
    },
    trigger: params.trigger,
  };
  if (params.reasonCode) {
    context.planner_reason_code = params.reasonCode;
  }
  if (params.reasonCategory) {
    context.planner_reason_category = params.reasonCategory;
  }

  if (typeof params.attemptIndex === "number") {
    context.attempt_index = params.attemptIndex;
  }

  if (params.errorMessage) {
    context.planner_error = params.errorMessage;
  }

  if (params.extraContext) {
    Object.assign(context, params.extraContext);
  }
  if (params.internalStats) {
    context.planner_internal = params.internalStats as Json;
  }

  await recordObservabilityEvent({
    source: params.source ?? "auto_assign",
    eventType: "auto_assign.quote",
    severity: params.severity,
    restaurantId: params.restaurantId,
    bookingId: params.bookingId,
    context: context as Json,
  });
}
