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
  const logJob = (stage: string, payload: Record<string, unknown> = {}) => {
    console.info("[auto-assign][job]", stage, { bookingId, ...payload });
  };

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
  let computedMaxAttempts: number | null = null;
  let summaryEmitted = false;
  let skippedInitialAttempt = false;
  let inlineSkipReasonCode: string | null = null;
  let hardStopReason: string | null = null;
  let emitAutoAssignSummary: ((result: AutoAssignSummaryResult, attemptsUsed: number) => Promise<void>) | null = null;
  let attempt = 0;

  try {
    const bookingSelect = await supabase
      .from("bookings")
      .select(
        "id, restaurant_id, status, booking_date, start_time, end_time, start_at, end_at, party_size, customer_email, customer_name, reference, seating_preference, booking_type, notes, source, loyalty_points_awarded, created_at, updated_at, auto_assign_idempotency_key, auto_assign_last_result, assignment_state, assignment_state_version, assignment_strategy",
      )
      .eq("id", bookingId)
      .maybeSingle();

    let booking: Tables<"bookings"> | null = null;

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
          return;
        }
        booking = fallbackRow as Tables<"bookings">;
      } else {
        console.error("[auto-assign] booking lookup failed", { bookingId, error: bookingSelect.error?.message ?? bookingSelect.error });
        logJob("failed.lookup", { error: bookingSelect.error?.message ?? bookingSelect.error });
        return;
      }
    } else if (!bookingSelect.data) {
      console.error("[auto-assign] booking lookup failed", { bookingId, error: "not_found" });
      logJob("failed.lookup", { error: "not_found" });
      return;
    } else {
      booking = bookingSelect.data as Tables<"bookings">;
    }

    const inlineLastResult = parseAutoAssignLastResult(booking.auto_assign_last_result ?? null);
    const inlineSummaryContext =
      inlineLastResult && inlineLastResult.source === "inline"
        ? {
            inline_attempt_id: inlineLastResult.attemptId ?? null,
            inline_reason: inlineLastResult.reason ?? null,
            inline_trigger: inlineLastResult.trigger ?? null,
          }
        : {};
    const inlineEmailAlreadySent = shouldSkipEmailForJob(inlineLastResult);
    const inlineIsRecent = isInlineResultRecent(inlineLastResult);

    // Skip non-actionable states
    if (["cancelled", "no_show", "completed"].includes(String(booking.status))) {
      logJob("skipped.status", { status: booking.status });
      return;
    }

    emitAutoAssignSummary = async (result, attemptsUsed) => {
      if (summaryEmitted) return;
      summaryEmitted = true;
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.summary",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: {
          attemptsUsed,
          maxAttempts: computedMaxAttempts,
          result,
          totalDurationMs: Date.now() - jobStartTime,
          trigger: reason,
          skippedInitialAttempt,
          inlineSkipReason: inlineSkipReasonCode,
          hardStopReason,
          ...inlineSummaryContext,
        },
      });
    };

    // If already confirmed (e.g., manual/other flow), ensure guest receives the ticket.
    if (booking.status === "confirmed") {
      if (!SUPPRESS_EMAILS) {
        if (inlineEmailAlreadySent) {
          logJob("email.skipped_inline_success", {
            inlineAttemptId: inlineLastResult?.attemptId ?? null,
            inlineReason: inlineLastResult?.reason ?? null,
          });
        } else {
          try {
            if (emailVariant === "modified") {
              await sendBookingModificationConfirmedEmail(booking as unknown as Tables<"bookings">);
            } else {
              await sendBookingConfirmationEmail(booking as unknown as Tables<"bookings">);
            }
          } catch (e) {
            console.error("[auto-assign] failed sending confirmation for already-confirmed", { bookingId, error: e });
            logJob("failed.email_already_confirmed", { error: e instanceof Error ? e.message : String(e) });
          }
        }
      }
      if (emitAutoAssignSummary) {
        await emitAutoAssignSummary("already_confirmed", 0);
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

    const startAt = typeof booking.start_at === 'string' ? new Date(booking.start_at) : null;
    const withinCutoff = () => {
      if (!startAt || Number.isNaN(startAt.getTime())) return false;
      const msUntilStart = startAt.getTime() - Date.now();
      return msUntilStart <= cutoffMinutes * 60_000;
    };

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    const plannerStrategy: PlannerStrategyContext = { requireAdjacency: null, maxTables: null };

    // Attempt loop configuration
    const inlineHardFailure = retryPolicyV2Enabled
      ? isInlineHardFailure(inlineLastResult)
      : inlineIsRecent && isInlineHardFailure(inlineLastResult);
    const inlineSkipDecision = retryPolicyV2Enabled
      ? shouldSkipFirstJobAttempt(inlineLastResult)
      : { skip: false, reasonCode: null };
    inlineSkipReasonCode = inlineSkipDecision.reasonCode ?? null;
    let maxAttempts = Math.max(1, Math.min(maxRetries + 1, 11));
    if (inlineHardFailure) {
      logJob("attempts.reduced.inline_no_capacity", {
        inlineAttemptId: inlineLastResult?.attemptId ?? null,
        inlineReason: inlineLastResult?.reason ?? "inline_hard_failure",
      });
      maxAttempts = Math.max(1, Math.min(2, maxAttempts));
    }
    if (inlineSkipDecision.skip) {
      skippedInitialAttempt = true;
      const previousMaxAttempts = maxAttempts;
      maxAttempts = Math.max(1, maxAttempts - 1);
      logJob("attempts.skip_initial_inline_recent", {
        inlineAttemptId: inlineLastResult?.attemptId ?? null,
        inlineReason: inlineLastResult?.reason ?? null,
        previousMaxAttempts,
        nextMaxAttempts: maxAttempts,
      });
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.inline_skip_attempt",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: {
          inline_attempt_id: inlineLastResult?.attemptId ?? null,
          reason: inlineLastResult?.reason ?? null,
          reasonCode: inlineSkipReasonCode,
          previousMaxAttempts,
          nextMaxAttempts: maxAttempts,
          trigger: reason,
        },
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
            inlineEmailAlreadySent,
            emailVariant,
            emitAutoAssignSummary,
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
    if (retryPolicyV2Enabled && inlineLastResult?.reason === "INLINE_TIMEOUT") {
      plannerStrategy.requireAdjacency = false;
      plannerStrategy.maxTables = plannerStrategy.maxTables ?? 4;
      maxAttempts = Math.max(1, Math.min(3, maxAttempts));
      await recordObservabilityEvent({
        source: "auto_assign",
        eventType: "auto_assign.inline_timeout_adjustment",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        context: {
          attempt_index: attempt,
          adjustedRequireAdjacency: plannerStrategy.requireAdjacency,
          adjustedMaxTables: plannerStrategy.maxTables,
          maxAttempts,
        },
      });
      logJob("strategy.adjust_inline_timeout", {
        inlineAttemptId: inlineLastResult.attemptId ?? null,
        plannerStrategy,
        maxAttempts,
      });
    }
    computedMaxAttempts = maxAttempts;

    while (attempt < maxAttempts) {
      logJob("attempt.start", { attempt, maxAttempts });
      if (attempt > 0 && withinCutoff()) {
        if (emitAutoAssignSummary) {
          await emitAutoAssignSummary("cutoff", attempt);
        }
        await recordObservabilityEvent({
          source: "auto_assign",
          eventType: "auto_assign.cutoff_skipped",
          restaurantId: booking.restaurant_id,
          bookingId: booking.id,
          context: {
            attempt_index: attempt,
            cutoffMinutes,
            ...(inlineHardFailure ? { inline_reason: inlineLastResult?.reason ?? null } : {}),
          },
        });
        logJob("attempt.cutoff_skipped", { attempt, cutoffMinutes });
        break;
      }

      const attemptStart = Date.now();
      let shouldRetry = true;
      const plannerOptions = {
        requireAdjacency:
          typeof plannerStrategy.requireAdjacency === "boolean" ? plannerStrategy.requireAdjacency : undefined,
        maxTables: typeof plannerStrategy.maxTables === "number" ? plannerStrategy.maxTables : undefined,
      };
      const plannerCacheKey =
        plannerCacheEnabled
          ? buildPlannerCacheKey({
              restaurantId: booking.restaurant_id,
              bookingDate: booking.booking_date ?? null,
              startTime: booking.start_time ?? null,
              partySize: booking.party_size ?? null,
              strategy: plannerStrategy,
              trigger: reason,
            })
          : null;
      const cachedEntry = plannerCacheEnabled && plannerCacheKey ? getPlannerCacheEntry(plannerCacheKey) : null;

      if (plannerCacheEnabled && cachedEntry && cachedEntry.status === "failure") {
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
          strategy: plannerStrategy,
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
            strategy: plannerStrategy,
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

            const { data: updated } = await supabase
              .from("bookings")
              .select("*")
              .eq("id", bookingId)
              .maybeSingle();
            if (updated && !SUPPRESS_EMAILS) {
              if (inlineEmailAlreadySent) {
                logJob("email.skipped_inline_context", {
                  inlineAttemptId: inlineLastResult?.attemptId ?? null,
                });
              } else if (emailVariant === "modified") {
                await sendBookingModificationConfirmedEmail(updated as unknown as Tables<"bookings">);
              } else {
                await sendBookingConfirmationEmail(updated as unknown as Tables<"bookings">);
              }
            }

            const durationMs = Date.now() - jobStartTime;
            await recordObservabilityEvent({
              source: "auto_assign",
              eventType: "auto_assign.succeeded",
              restaurantId: booking.restaurant_id,
              bookingId: booking.id,
              context: { attempt_index: attempt, durationMs, trigger: reason },
            });
            if (emitAutoAssignSummary) {
              await emitAutoAssignSummary("succeeded", attempt + 1);
            }
            logJob("attempt.success", { attempt, holdId: quote.hold.id, durationMs });
            return;
          }
        } catch (e) {
          const plannerDurationMs = Date.now() - plannerStart;
          const plannerErrorReason = e instanceof Error && e.name ? e.name : "QUOTE_ERROR";
          const classification = classifyPlannerReason(plannerErrorReason);

          await recordPlannerQuoteTelemetry({
            restaurantId: booking.restaurant_id,
            bookingId: booking.id,
            durationMs: plannerDurationMs,
            success: false,
            reason: plannerErrorReason,
            reasonCode: classification.code,
            reasonCategory: classification.category,
            strategy: plannerStrategy,
            trigger: reason,
            attemptIndex: attempt,
            errorMessage: e instanceof Error ? e.message : String(e),
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
              error: e instanceof Error ? e.message : String(e),
              reasonCode: classification.code,
              trigger: reason,
            },
          });
          logJob("attempt.error", { attempt, error: e instanceof Error ? e.message : String(e) });
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
      if (attempt >= maxAttempts) break;
      const delay = delays[Math.min(attempt - 1, delays.length - 1)] ?? 5000;
      const elapsed = Date.now() - attemptStart;
      const toSleep = Math.max(0, delay - elapsed);
      if (toSleep > 0) {
        await sleep(toSleep);
      }
      const { data: latest } = await supabase.from("bookings").select("status").eq("id", bookingId).maybeSingle();
      if (latest?.status === "confirmed") {
        if (emitAutoAssignSummary) {
          await emitAutoAssignSummary("already_confirmed", attempt);
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
    if (emitAutoAssignSummary) {
      await emitAutoAssignSummary("exhausted", attempt);
    }
    logJob("exhausted", { attempts: attempt, maxAttempts });
  } catch (e) {
    if (emitAutoAssignSummary) {
      await emitAutoAssignSummary("error", attempt);
    }
    console.error("[auto-assign] unexpected error", { bookingId, error: e });
    logJob("failed.unexpected", { error: e instanceof Error ? e.message : String(e) });
  }
}

type CoordinatorHandlerParams = {
  bookingId: string;
  booking: Tables<"bookings">;
  result: AssignmentCoordinatorResult;
  logJob: (stage: string, payload?: Record<string, unknown>) => void;
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
