import { AssignmentCoordinator } from "@/server/assignments";
import { disableAssignmentPipelineRuntime, isAssignmentPipelineSchemaError } from "@/server/assignments/runtime-guard";
import {
  parseAutoAssignLastResult,
  isInlineResultRecent,
  isInlineHardFailure,
  shouldSkipEmailForJob,
  shouldSkipFirstJobAttempt,
} from "@/server/capacity/auto-assign-last-result";
import {
  isPlannerCacheEnabled,
  buildPlannerCacheKey,
  getPlannerCacheEntry,
  setPlannerCacheEntry,
} from "@/server/capacity/planner-cache";
import { classifyPlannerReason } from "@/server/capacity/planner-reason";
import { recordPlannerQuoteTelemetry } from "@/server/capacity/planner-telemetry";
import { quoteTablesForBooking, atomicConfirmAndTransition } from "@/server/capacity/tables";
import { sendBookingConfirmationEmail, sendBookingModificationConfirmedEmail } from "@/server/emails/bookings";
import {
  isAutoAssignOnBookingEnabled,
  getAutoAssignMaxRetries,
  getAutoAssignRetryDelaysMs,
  getAutoAssignStartCutoffMinutes,
  isAutoAssignRetryPolicyV2Enabled,
  isAssignmentPipelineV3Enabled,
} from "@/server/feature-flags";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { AssignmentCoordinatorResult } from "@/server/assignments";
import type { PlannerStrategyContext } from "@/server/capacity/planner-telemetry";
import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";


type AutoAssignReason = "creation" | "modification";
type AutoAssignEmailVariant = "standard" | "modified";

type AutoAssignOptions = {
  bypassFeatureFlag?: boolean;
  reason?: AutoAssignReason;
  emailVariant?: AutoAssignEmailVariant;
};

type AutoAssignSummaryResult = "succeeded" | "cutoff" | "already_confirmed" | "exhausted" | "error";
type BookingRow = Tables<"bookings">;
type JobLogger = (stage: string, payload?: Record<string, unknown>) => void;

export type InlineContext = {
  inlineLastResult: ReturnType<typeof parseAutoAssignLastResult>;
  inlineSummaryContext: Record<string, unknown>;
  inlineEmailAlreadySent: boolean;
  inlineIsRecent: boolean;
};

export type AttemptPlan = {
  plannerStrategy: PlannerStrategyContext;
  maxAttempts: number;
  skippedInitialAttempt: boolean;
  inlineSkipReasonCode: string | null;
  inlineHardFailure: boolean;
  inlineTimeoutAdjusted: boolean;
  policyVersion: "v1" | "v2";
};

type SummaryContext = {
  maxAttempts: number | null;
  skippedInitialAttempt: boolean;
  inlineSkipReason: string | null;
  hardStopReason: string | null;
  policyVersion: "v1" | "v2";
  plannerCacheHits: number;
  plannerCacheHardStops: number;
};

type SummaryEmitter = {
  updateContext: (context: Partial<SummaryContext>) => void;
  emit: (result: AutoAssignSummaryResult, attemptsUsed: number, extraContext?: Partial<SummaryContext>) => Promise<void>;
};

let assignmentCoordinatorInstance: AssignmentCoordinator | null | undefined;
function getAssignmentCoordinator(): AssignmentCoordinator | null {
  if (assignmentCoordinatorInstance !== undefined) {
    return assignmentCoordinatorInstance;
  }
  try {
    assignmentCoordinatorInstance = new AssignmentCoordinator();
  } catch (error) {
    assignmentCoordinatorInstance = null;
    console.warn("[auto-assign][coordinator] unavailable, falling back to legacy planner", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return assignmentCoordinatorInstance;
}

/**
 * Attempts to automatically assign tables for a booking and flips status to confirmed.
 * Sends the configured confirmation email variant on success.
 *
 * Best-effort: swallows errors and logs; safe to fire-and-forget.
 */
export async function autoAssignAndConfirmIfPossible(
  bookingId: string,
  options?: AutoAssignOptions,
): Promise<void> {
  const SUPPRESS_EMAILS = process.env.LOAD_TEST_DISABLE_EMAILS === 'true' || process.env.SUPPRESS_EMAILS === 'true';
  const logJob = createJobLogger(bookingId);

  const shouldRun = options?.bypassFeatureFlag || isAutoAssignOnBookingEnabled();
  if (!shouldRun) {
    logJob("skipped.feature-flag", { bypass: Boolean(options?.bypassFeatureFlag) });
    return;
  }

  const emailVariant: AutoAssignEmailVariant = options?.emailVariant ?? "standard";
  const reason: AutoAssignReason = options?.reason ?? "creation";
  logJob("scheduled", { reason, emailVariant, bypass: Boolean(options?.bypassFeatureFlag) });

  const supabase = getServiceSupabaseClient();
  const retryPolicyV2Enabled = isAutoAssignRetryPolicyV2Enabled();
  const plannerCacheEnabled = retryPolicyV2Enabled && isPlannerCacheEnabled();
  const jobStartTime = Date.now();
  let summary: SummaryEmitter | null = null;

  try {
    const booking = await loadBookingWithFallback({ supabase, bookingId, logJob });
    if (!booking) return;

    const inlineContext = buildInlineContext(booking);
    summary = createSummaryEmitter({
      booking,
      reason,
      jobStartTime,
      inlineSummaryContext: inlineContext.inlineSummaryContext,
      policyVersion: retryPolicyV2Enabled ? "v2" : "v1",
    });

    // Skip non-actionable states
    if (["cancelled", "no_show", "completed"].includes(String(booking.status))) {
      logJob("skipped.status", { status: booking.status });
      return;
    }

    // If already confirmed (e.g., manual/other flow), ensure guest receives the ticket.
    if (booking.status === "confirmed") {
      await sendConfirmationEmail({
        booking,
        bookingId,
        emailVariant,
        inlineEmailAlreadySent: inlineContext.inlineEmailAlreadySent,
        inlineLastResult: inlineContext.inlineLastResult,
        suppressEmails: SUPPRESS_EMAILS,
        logJob,
      });
      if (summary) {
        await summary.emit("already_confirmed", 0, { maxAttempts: 0 });
      }
      return;
    }

    await recordObservabilityEvent({
      source: "auto_assign",
      eventType: "auto_assign.started",
      restaurantId: booking.restaurant_id,
      bookingId: booking.id,
      context: { status: booking.status, trigger: reason },
    });

    const maxRetries = getAutoAssignMaxRetries();
    const delays = getAutoAssignRetryDelaysMs();
    const cutoffMinutes = getAutoAssignStartCutoffMinutes();

    const attemptPlan = buildAttemptPlan({
      inlineContext,
      retryPolicyV2Enabled,
      maxRetries,
      baseStrategy: { requireAdjacency: null, maxTables: null },
    });

    summary.updateContext({
      maxAttempts: attemptPlan.maxAttempts,
      skippedInitialAttempt: attemptPlan.skippedInitialAttempt,
      inlineSkipReason: attemptPlan.inlineSkipReasonCode,
      policyVersion: attemptPlan.policyVersion,
    });

    if (attemptPlan.inlineHardFailure) {
      logJob("attempts.reduced.inline_no_capacity", {
        inlineAttemptId: inlineContext.inlineLastResult?.attemptId ?? null,
        inlineReason: inlineContext.inlineLastResult?.reason ?? "inline_hard_failure",
      });
    }
    if (attemptPlan.skippedInitialAttempt) {
      const previousMaxAttempts = attemptPlan.maxAttempts + 1;
      logJob("attempts.skip_initial_inline_recent", {
        inlineAttemptId: inlineContext.inlineLastResult?.attemptId ?? null,
        inlineReason: inlineContext.inlineLastResult?.reason ?? null,
        previousMaxAttempts,
        nextMaxAttempts: attemptPlan.maxAttempts,
      });
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.inline_skip_attempt",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: {
          inline_attempt_id: inlineContext.inlineLastResult?.attemptId ?? null,
          reason: inlineContext.inlineLastResult?.reason ?? null,
          reasonCode: attemptPlan.inlineSkipReasonCode,
          previousMaxAttempts,
          nextMaxAttempts: attemptPlan.maxAttempts,
          trigger: reason,
        },
      });
    }
    if (attemptPlan.inlineTimeoutAdjusted) {
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.inline_timeout_adjustment",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: {
          attempt_index: 0,
          adjustedRequireAdjacency: attemptPlan.plannerStrategy.requireAdjacency,
          adjustedMaxTables: attemptPlan.plannerStrategy.maxTables,
          maxAttempts: attemptPlan.maxAttempts,
        },
      });
      logJob("strategy.adjust_inline_timeout", {
        inlineAttemptId: inlineContext.inlineLastResult?.attemptId ?? null,
        plannerStrategy: attemptPlan.plannerStrategy,
        maxAttempts: attemptPlan.maxAttempts,
      });
    }

    if (isAssignmentPipelineV3Enabled()) {
      const coordinator = getAssignmentCoordinator();
      if (coordinator) {
        try {
          const coordinatorResult = await coordinator.processBooking(booking.id, reason);
          await handleCoordinatorResult({
            bookingId,
            booking,
            result: coordinatorResult,
            logJob,
            suppressEmails: SUPPRESS_EMAILS,
            inlineEmailAlreadySent: inlineContext.inlineEmailAlreadySent,
            emailVariant,
            emitAutoAssignSummary: summary ? summary.emit : null,
            supabase,
          });
          return;
        } catch (coordinatorError) {
          if (isAssignmentPipelineSchemaError(coordinatorError)) {
            disableAssignmentPipelineRuntime("schema_incompatible_process", coordinatorError);
            logJob("coordinator.schema_disabled", { error: coordinatorError instanceof Error ? coordinatorError.message : String(coordinatorError) });
          } else {
            throw coordinatorError;
          }
        }
      } else {
        logJob("coordinator.unavailable_fallback", { reason: "missing_redis_config" });
      }
    }

    const startAt = typeof booking.start_at === 'string' ? new Date(booking.start_at) : null;
    await runLegacyAutoAssign({
      attemptPlan,
      booking,
      bookingId,
      cutoffMinutes,
      delays,
      emailVariant,
      inlineContext,
      jobStartTime,
      logJob,
      plannerCacheEnabled,
      reason,
      retryPolicyV2Enabled,
      startAt,
      supabase,
      summary,
      suppressEmails: SUPPRESS_EMAILS,
    });
  } catch (e) {
    if (summary) {
      await summary.emit("error", 0);
    }
    console.error("[auto-assign] unexpected error", { bookingId, error: e });
    logJob("failed.unexpected", { error: e instanceof Error ? e.message : String(e) });
  }
}

function createJobLogger(bookingId: string): JobLogger {
  return (stage: string, payload: Record<string, unknown> = {}) => {
    console.info("[auto-assign][job]", stage, { bookingId, ...payload });
  };
}

async function loadBookingWithFallback(params: {
  supabase: SupabaseClient<Database>;
  bookingId: string;
  logJob: JobLogger;
}): Promise<BookingRow | null> {
  const { supabase, bookingId, logJob } = params;
  const bookingSelect = await supabase
    .from("bookings")
    .select(
      "id, restaurant_id, status, booking_date, start_time, end_time, start_at, end_at, party_size, customer_email, customer_name, reference, seating_preference, booking_type, notes, source, loyalty_points_awarded, created_at, updated_at, auto_assign_idempotency_key, auto_assign_last_result, assignment_state, assignment_state_version, assignment_strategy",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingSelect.error) {
    if (isAssignmentPipelineSchemaError(bookingSelect.error)) {
      disableAssignmentPipelineRuntime("schema_incompatible_select", bookingSelect.error);
      const { data: fallbackRow, error: fallbackError } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      if (fallbackError || !fallbackRow) {
        console.error("[auto-assign] booking lookup failed", {
          bookingId,
          error: fallbackError?.message ?? fallbackError ?? bookingSelect.error?.message ?? bookingSelect.error,
        });
        logJob("failed.lookup", { error: fallbackError?.message ?? fallbackError ?? bookingSelect.error?.message ?? bookingSelect.error });
        return null;
      }
      return fallbackRow as BookingRow;
    }
    console.error("[auto-assign] booking lookup failed", { bookingId, error: bookingSelect.error?.message ?? bookingSelect.error });
    logJob("failed.lookup", { error: bookingSelect.error?.message ?? bookingSelect.error });
    return null;
  }

  if (!bookingSelect.data) {
    console.error("[auto-assign] booking lookup failed", { bookingId, error: "not_found" });
    logJob("failed.lookup", { error: "not_found" });
    return null;
  }

  return bookingSelect.data as BookingRow;
}

function buildInlineContext(booking: BookingRow): InlineContext {
  const inlineLastResult = parseAutoAssignLastResult(booking.auto_assign_last_result ?? null);
  const inlineSummaryContext =
    inlineLastResult && inlineLastResult.source === "inline"
      ? {
          inline_attempt_id: inlineLastResult.attemptId ?? null,
          inline_reason: inlineLastResult.reason ?? null,
          inline_trigger: inlineLastResult.trigger ?? null,
        }
      : {};

  return {
    inlineLastResult,
    inlineSummaryContext,
    inlineEmailAlreadySent: shouldSkipEmailForJob(inlineLastResult),
    inlineIsRecent: isInlineResultRecent(inlineLastResult),
  };
}

export function buildAttemptPlan(params: {
  inlineContext: InlineContext;
  retryPolicyV2Enabled: boolean;
  maxRetries: number;
  baseStrategy?: PlannerStrategyContext;
}): AttemptPlan {
  const { inlineContext, retryPolicyV2Enabled, maxRetries } = params;
  const plannerStrategy: PlannerStrategyContext = {
    ...(params.baseStrategy ?? { requireAdjacency: null, maxTables: null }),
  };

  const policyVersion: "v1" | "v2" = retryPolicyV2Enabled ? "v2" : "v1";
  const inlineHardFailure =
    policyVersion === "v2"
      ? isInlineHardFailure(inlineContext.inlineLastResult)
      : inlineContext.inlineIsRecent && isInlineHardFailure(inlineContext.inlineLastResult);
  const inlineSkipDecision =
    policyVersion === "v2" ? shouldSkipFirstJobAttempt(inlineContext.inlineLastResult) : { skip: false, reasonCode: null };

  let maxAttempts = Math.max(1, Math.min(maxRetries + 1, 11));
  if (inlineHardFailure) {
    maxAttempts = Math.max(1, Math.min(2, maxAttempts));
  }

  let skippedInitialAttempt = false;
  if (inlineSkipDecision.skip) {
    skippedInitialAttempt = true;
    maxAttempts = Math.max(1, maxAttempts - 1);
  }

  let inlineTimeoutAdjusted = false;
  if (retryPolicyV2Enabled && inlineContext.inlineLastResult?.reason === "INLINE_TIMEOUT") {
    plannerStrategy.requireAdjacency = false;
    plannerStrategy.maxTables = plannerStrategy.maxTables ?? 4;
    maxAttempts = Math.max(1, Math.min(3, maxAttempts));
    inlineTimeoutAdjusted = true;
  }

  return {
    plannerStrategy,
    maxAttempts,
    skippedInitialAttempt,
    inlineSkipReasonCode: inlineSkipDecision.reasonCode ?? null,
    inlineHardFailure,
    inlineTimeoutAdjusted,
    policyVersion,
  };
}

function createSummaryEmitter(params: {
  booking: BookingRow;
  reason: AutoAssignReason;
  jobStartTime: number;
  inlineSummaryContext: Record<string, unknown>;
  policyVersion: "v1" | "v2";
}): SummaryEmitter {
  const { booking, reason, jobStartTime, inlineSummaryContext, policyVersion } = params;
  let emitted = false;
  let context: SummaryContext = {
    maxAttempts: null,
    skippedInitialAttempt: false,
    inlineSkipReason: null,
    hardStopReason: null,
    policyVersion,
    plannerCacheHits: 0,
    plannerCacheHardStops: 0,
  };

  return {
    updateContext(partialContext) {
      context = { ...context, ...partialContext };
    },
    async emit(result, attemptsUsed, extraContext = {}) {
      if (emitted) return;
      emitted = true;
      const mergedContext = { ...context, ...extraContext };
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.summary",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: {
          attemptsUsed,
          maxAttempts: mergedContext.maxAttempts,
          result,
          totalDurationMs: Date.now() - jobStartTime,
          trigger: reason,
          skippedInitialAttempt: mergedContext.skippedInitialAttempt,
          inlineSkipReason: mergedContext.inlineSkipReason,
          hardStopReason: mergedContext.hardStopReason,
          policyVersion: mergedContext.policyVersion,
          plannerCacheHits: mergedContext.plannerCacheHits,
          plannerCacheHardStops: mergedContext.plannerCacheHardStops,
          ...inlineSummaryContext,
        },
      });
    },
  };
}

async function sendConfirmationEmail(params: {
  booking: BookingRow;
  bookingId: string;
  emailVariant: AutoAssignEmailVariant;
  inlineEmailAlreadySent: boolean;
  inlineLastResult: ReturnType<typeof parseAutoAssignLastResult>;
  suppressEmails: boolean;
  logJob: JobLogger;
  skipStage?: string;
}): Promise<void> {
  const { booking, bookingId, emailVariant, inlineEmailAlreadySent, inlineLastResult, suppressEmails, logJob, skipStage } = params;
  if (suppressEmails) return;

  if (inlineEmailAlreadySent) {
    logJob(skipStage ?? "email.skipped_inline_success", {
      inlineAttemptId: inlineLastResult?.attemptId ?? null,
      inlineReason: inlineLastResult?.reason ?? null,
    });
    return;
  }

  try {
    const bookingRecord = booking as unknown as Tables<"bookings">;
    if (emailVariant === "modified") {
      await sendBookingModificationConfirmedEmail(bookingRecord);
    } else {
      await sendBookingConfirmationEmail(bookingRecord);
    }
  } catch (error) {
    console.error("[auto-assign] failed sending confirmation", { bookingId, error });
    logJob("failed.email", { error: error instanceof Error ? error.message : String(error) });
  }
}

async function runLegacyAutoAssign(params: {
  attemptPlan: AttemptPlan;
  booking: BookingRow;
  bookingId: string;
  cutoffMinutes: number;
  delays: number[];
  emailVariant: AutoAssignEmailVariant;
  inlineContext: InlineContext;
  jobStartTime: number;
  logJob: JobLogger;
  plannerCacheEnabled: boolean;
  reason: AutoAssignReason;
  retryPolicyV2Enabled: boolean;
  startAt: Date | null;
  supabase: SupabaseClient<Database>;
  summary: SummaryEmitter | null;
  suppressEmails: boolean;
}): Promise<void> {
  const {
    attemptPlan,
    booking,
    bookingId,
    cutoffMinutes,
    delays,
    emailVariant,
    inlineContext,
    jobStartTime,
    logJob,
    plannerCacheEnabled,
    reason,
    retryPolicyV2Enabled,
    startAt,
    supabase,
    summary,
    suppressEmails,
  } = params;

  const withinCutoff = () => {
    if (!startAt || Number.isNaN(startAt.getTime())) return false;
    const msUntilStart = startAt.getTime() - Date.now();
    return msUntilStart <= cutoffMinutes * 60_000;
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  let attempt = 0;
  let hardStopReason: string | null = null;
  let cacheHits = 0;
  let cacheHardStops = 0;

  while (attempt < attemptPlan.maxAttempts) {
    logJob("attempt.start", { attempt, maxAttempts: attemptPlan.maxAttempts });

    if (attempt > 0 && withinCutoff()) {
      if (summary) {
        await summary.emit("cutoff", attempt, {
          hardStopReason,
          plannerCacheHits: cacheHits,
          plannerCacheHardStops: cacheHardStops,
        });
      }
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.cutoff_skipped",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: {
          attempt_index: attempt,
          cutoffMinutes,
          ...(attemptPlan.inlineHardFailure ? { inline_reason: inlineContext.inlineLastResult?.reason ?? null } : {}),
        },
      });
      logJob("attempt.cutoff_skipped", { attempt, cutoffMinutes });
      break;
    }

    const attemptStart = Date.now();
    let shouldRetry = true;
    const plannerOptions = {
      requireAdjacency:
        typeof attemptPlan.plannerStrategy.requireAdjacency === "boolean"
          ? attemptPlan.plannerStrategy.requireAdjacency
          : undefined,
      maxTables: typeof attemptPlan.plannerStrategy.maxTables === "number" ? attemptPlan.plannerStrategy.maxTables : undefined,
    };
    const plannerCacheKey =
      plannerCacheEnabled
        ? buildPlannerCacheKey({
            restaurantId: booking.restaurant_id,
            bookingDate: booking.booking_date ?? null,
            startTime: booking.start_time ?? null,
            partySize: booking.party_size ?? null,
            strategy: attemptPlan.plannerStrategy,
            trigger: reason,
          })
        : null;
    const cachedEntry = plannerCacheEnabled && plannerCacheKey ? getPlannerCacheEntry(plannerCacheKey) : null;

    if (plannerCacheEnabled && cachedEntry && cachedEntry.status === "failure") {
      cacheHits += 1;
      if (summary) {
        summary.updateContext({ plannerCacheHits: cacheHits, plannerCacheHardStops: cacheHardStops });
      }
      const classification = {
        code: cachedEntry.reasonCode ?? "cached_failure",
        category: cachedEntry.reasonCategory ?? "unknown",
      };
      await recordPlannerQuoteTelemetry({
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        durationMs: 0,
        success: false,
        reason: cachedEntry.reason ?? null,
        reasonCode: classification.code,
        reasonCategory: classification.category,
        strategy: attemptPlan.plannerStrategy,
        trigger: reason,
        attemptIndex: attempt,
        extraContext: { cache_hit: true },
      });
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.planner_cache_hit",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: {
          attempt_index: attempt,
          cache_status: cachedEntry.status,
          reason: cachedEntry.reason ?? null,
          reasonCode: classification.code,
          trigger: reason,
        },
      });
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.attempt",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: {
          attempt_index: attempt,
          success: false,
          reason: cachedEntry.reason ?? "NO_HOLD",
          reasonCode: classification.code,
          alternates: 0,
          trigger: reason,
          cache_hit: true,
        },
      });
      logJob("attempt.cache_skipped", {
        attempt,
        reason: cachedEntry.reason ?? "cached_failure",
        reasonCode: classification.code,
      });
      if (retryPolicyV2Enabled && classification.category === "hard") {
        shouldRetry = false;
        hardStopReason = classification.code;
        cacheHardStops += 1;
        if (summary) {
          summary.updateContext({ plannerCacheHardStops: cacheHardStops, plannerCacheHits: cacheHits });
        }
      }
    } else {
      const plannerStart = Date.now();
      try {
        const quote = await quoteTablesForBooking({
          bookingId,
          // createdBy is optional down the stack; pass undefined to store NULL
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createdBy: (undefined as any) as string,
          holdTtlSeconds: 180,
          requireAdjacency: plannerOptions.requireAdjacency,
          maxTables: plannerOptions.maxTables,
        });
        const plannerDurationMs = Date.now() - plannerStart;
        const classification = classifyPlannerReason(quote.reason ?? null);

        await recordPlannerQuoteTelemetry({
          restaurantId: booking.restaurant_id,
          bookingId: booking.id,
          durationMs: plannerDurationMs,
          success: Boolean(quote.hold),
          reason: quote.reason ?? null,
          reasonCode: classification.code,
          reasonCategory: classification.category,
          strategy: attemptPlan.plannerStrategy,
          trigger: reason,
          attemptIndex: attempt,
          internalStats: quote.plannerStats ?? null,
        });

        if (plannerCacheEnabled && plannerCacheKey) {
          setPlannerCacheEntry(plannerCacheKey, {
            status: quote.hold ? "success" : "failure",
            reason: quote.reason ?? null,
            reasonCode: classification.code,
            reasonCategory: classification.category,
          });
        }

        if (!quote.hold) {
          await recordObservabilityEvent({
            source: "auto_assign",
            eventType: "auto_assign.attempt",
            restaurantId: booking.restaurant_id,
            bookingId: booking.id,
            context: {
              attempt_index: attempt,
              success: false,
              reason: quote.reason ?? "NO_HOLD",
              reasonCode: classification.code,
              alternates: (quote.alternates ?? []).length,
              trigger: reason,
            },
          });
          logJob("attempt.no_hold", {
            attempt,
            reason: quote.reason ?? "NO_HOLD",
            alternates: (quote.alternates ?? []).length,
          });

          if (retryPolicyV2Enabled && classification.category === "hard") {
            shouldRetry = false;
            hardStopReason = classification.code;
            await recordObservabilityEvent({
              source: "auto_assign",
              eventType: "auto_assign.hard_stop",
              restaurantId: booking.restaurant_id,
              bookingId: booking.id,
              context: {
                attempt_index: attempt,
                reason: quote.reason ?? null,
                reasonCode: classification.code,
                trigger: reason,
              },
            });
          }
        } else {
          const idempotencyKey = booking.auto_assign_idempotency_key ?? `auto-${bookingId}`;

          await atomicConfirmAndTransition({
            bookingId,
            holdId: quote.hold.id,
            idempotencyKey,
            assignedBy: null,
            historyReason: "auto_assign",
            historyMetadata: { source: "auto-assign", holdId: quote.hold.id },
          });

          const { data: updated } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
          if (updated) {
            await sendConfirmationEmail({
              booking: updated as BookingRow,
              bookingId,
              emailVariant,
              inlineEmailAlreadySent: inlineContext.inlineEmailAlreadySent,
              inlineLastResult: inlineContext.inlineLastResult,
              suppressEmails,
              logJob,
              skipStage: "email.skipped_inline_context",
            });
          }

          const durationMs = Date.now() - jobStartTime;
          await recordObservabilityEvent({
            source: "auto_assign",
            eventType: "auto_assign.succeeded",
            restaurantId: booking.restaurant_id,
            bookingId: booking.id,
            context: { attempt_index: attempt, durationMs, trigger: reason },
          });
          if (summary) {
            await summary.emit("succeeded", attempt + 1, {
              hardStopReason,
              plannerCacheHits: cacheHits,
              plannerCacheHardStops: cacheHardStops,
            });
          }
          logJob("attempt.success", { attempt, holdId: quote.hold.id, durationMs });
          return;
        }
      } catch (error) {
        const plannerDurationMs = Date.now() - plannerStart;
        const plannerErrorReason = error instanceof Error && error.name ? error.name : "QUOTE_ERROR";
        const classification = classifyPlannerReason(plannerErrorReason);

        await recordPlannerQuoteTelemetry({
          restaurantId: booking.restaurant_id,
          bookingId: booking.id,
          durationMs: plannerDurationMs,
          success: false,
          reason: plannerErrorReason,
          reasonCode: classification.code,
          reasonCategory: classification.category,
          strategy: attemptPlan.plannerStrategy,
          trigger: reason,
          attemptIndex: attempt,
          errorMessage: error instanceof Error ? error.message : String(error),
          severity: "warning",
        });

        if (plannerCacheEnabled && plannerCacheKey) {
          setPlannerCacheEntry(plannerCacheKey, {
            status: "failure",
            reason: plannerErrorReason,
            reasonCode: classification.code,
            reasonCategory: classification.category,
          });
        }

        await recordObservabilityEvent({
          source: "auto_assign",
          eventType: "auto_assign.attempt_error",
          severity: "warning",
          restaurantId: booking.restaurant_id,
          bookingId: booking.id,
          context: {
            attempt_index: attempt,
            error: error instanceof Error ? error.message : String(error),
            reasonCode: classification.code,
            trigger: reason,
          },
        });
        logJob("attempt.error", { attempt, error: error instanceof Error ? error.message : String(error) });
        if (retryPolicyV2Enabled && classification.category === "hard") {
          shouldRetry = false;
          hardStopReason = classification.code;
        }
      }
    }

    attempt += 1;
    if (!shouldRetry) {
      logJob("attempt.stop_reason", { attempt, reason: hardStopReason });
      break;
    }
    if (attempt >= attemptPlan.maxAttempts) break;

    const delay = delays[Math.min(attempt - 1, delays.length - 1)] ?? 5000;
    const elapsed = Date.now() - attemptStart;
    const toSleep = Math.max(0, delay - elapsed);
    if (toSleep > 0) {
      await sleep(toSleep);
    }

    const { data: latest } = await supabase.from("bookings").select("status").eq("id", bookingId).maybeSingle();
    if (latest?.status === "confirmed") {
      if (summary) {
        await summary.emit("already_confirmed", attempt, {
          hardStopReason,
          plannerCacheHits: cacheHits,
          plannerCacheHardStops: cacheHardStops,
        });
      }
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.exited_already_confirmed",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: { attempt_index: attempt, trigger: reason },
      });
      logJob("attempt.success_race", { attempt });
      return;
    }
  }

  await recordObservabilityEvent({
    source: "auto_assign",
    eventType: "auto_assign.failed",
    severity: "warning",
    restaurantId: booking.restaurant_id,
    bookingId: booking.id,
    context: { attempts: attempt, trigger: reason, hardStopReason },
  });
  if (summary) {
    await summary.emit("exhausted", attempt, {
      hardStopReason,
      plannerCacheHits: cacheHits,
      plannerCacheHardStops: cacheHardStops,
    });
  }
  logJob("exhausted", { attempts: attempt, maxAttempts: attemptPlan.maxAttempts });
}

type CoordinatorHandlerParams = {
  bookingId: string;
  booking: BookingRow;
  result: AssignmentCoordinatorResult;
  logJob: JobLogger;
  suppressEmails: boolean;
  inlineEmailAlreadySent: boolean;
  emailVariant: AutoAssignEmailVariant;
  emitAutoAssignSummary: ((result: AutoAssignSummaryResult, attemptsUsed: number) => Promise<void>) | null;
  supabase: SupabaseClient<Database>;
};

async function handleCoordinatorResult(params: CoordinatorHandlerParams): Promise<void> {
  const {
    bookingId,
    booking,
    result,
    logJob,
    suppressEmails,
    inlineEmailAlreadySent,
    emailVariant,
    emitAutoAssignSummary,
    supabase,
  } = params;

  const attemptsUsed = 1;

  if (result.outcome === "confirmed") {
    if (!suppressEmails) {
      const { data: updated } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      const bookingRecord = (updated ?? booking) as unknown as Tables<"bookings">;
      try {
        if (inlineEmailAlreadySent) {
          logJob("email.skipped_inline_success");
        } else if (emailVariant === "modified") {
          await sendBookingModificationConfirmedEmail(bookingRecord);
        } else {
          await sendBookingConfirmationEmail(bookingRecord);
        }
      } catch (error) {
        console.error("[auto-assign] coordinator email failure", { bookingId, error });
      }
    }

    await recordObservabilityEvent({
      source: "auto_assign",
      eventType: "auto_assign.succeeded",
      restaurantId: booking.restaurant_id,
      bookingId,
      context: { attempt_index: 0, trigger: "coordinator" },
    });
    if (emitAutoAssignSummary) {
      await emitAutoAssignSummary("succeeded", attemptsUsed);
    }
    logJob("coordinator.success", { holdId: result.holdId });
    return;
  }

  if (result.outcome === "manual_review") {
    await recordObservabilityEvent({
      source: "auto_assign",
      eventType: "auto_assign.manual_review",
      restaurantId: booking.restaurant_id,
      bookingId,
      context: { trigger: "coordinator", reason: result.reason },
    });
    if (emitAutoAssignSummary) {
      await emitAutoAssignSummary("exhausted", attemptsUsed);
    }
    logJob("coordinator.manual_review", { reason: result.reason });
    return;
  }

  if (result.outcome === "retry") {
    await recordObservabilityEvent({
      source: "auto_assign",
      eventType: "auto_assign.retry_scheduled",
      restaurantId: booking.restaurant_id,
      bookingId,
      context: { delayMs: result.delayMs, trigger: "coordinator" },
    });
    logJob("coordinator.retry", { delayMs: result.delayMs, reason: result.reason });
    if (result.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, result.delayMs));
    }
    if (emitAutoAssignSummary) {
      await emitAutoAssignSummary("error", attemptsUsed);
    }
    return;
  }

  logJob("coordinator.noop", { reason: result.reason });
  if (emitAutoAssignSummary) {
    await emitAutoAssignSummary("error", attemptsUsed);
  }
}
