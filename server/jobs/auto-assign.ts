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
import {
  sendBookingConfirmationEmail,
  sendBookingModificationConfirmedEmail,
  sendBookingPendingAttentionEmail,
} from "@/server/emails/bookings";
import {
  isAutoAssignOnBookingEnabled,
  getAutoAssignMaxRetries,
  getAutoAssignRetryDelaysMs,
  getAutoAssignStartCutoffMinutes,
  isAutoAssignRetryPolicyV2Enabled,
} from "@/server/feature-flags";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { BookingRecord } from "@/server/bookings";
import type { PlannerStrategyContext } from "@/server/capacity/planner-telemetry";
import type { Tables } from "@/types/supabase";


type AutoAssignReason = "creation" | "modification";
type AutoAssignEmailVariant = "standard" | "modified";

type AutoAssignOptions = {
  bypassFeatureFlag?: boolean;
  reason?: AutoAssignReason;
  emailVariant?: AutoAssignEmailVariant;
};

type AutoAssignSummaryResult = "succeeded" | "cutoff" | "already_confirmed" | "exhausted" | "error";
type SupabaseServiceClient = ReturnType<typeof getServiceSupabaseClient>;

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

async function maybeNotifyAdminPending(params: {
  booking: Tables<"bookings">;
  supabase: SupabaseServiceClient;
  reason: string | null;
  suppressEmails: boolean;
  logJob: (stage: string, payload?: Record<string, unknown>) => void;
}) {
  const status = String(params.booking.status ?? "");
  if (["confirmed", "cancelled", "no_show", "completed"].includes(status)) {
    params.logJob("pending_admin.notify_skipped_status", { bookingId: params.booking.id, status });
    return;
  }

  const details = toRecord(params.booking.details);
  const alreadyNotified =
    typeof details.pending_admin_notified_at === "string" && details.pending_admin_notified_at.length > 0;

  if (alreadyNotified) {
    params.logJob("pending_admin.notify_skipped_existing", { bookingId: params.booking.id });
    return;
  }

  if (params.suppressEmails) {
    params.logJob("pending_admin.notify_skipped_suppressed", { bookingId: params.booking.id });
    return;
  }

  const nowIso = new Date().toISOString();
  const nextDetails = {
    ...details,
    pending_admin_notified_at: nowIso,
    pending_admin_reason: params.reason ?? null,
  };

  const { data, error } = await params.supabase
    .from("bookings")
    .update({ details: nextDetails })
    .eq("id", params.booking.id)
    .is("details->>pending_admin_notified_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[auto-assign] failed marking pending admin notification", {
      bookingId: params.booking.id,
      error,
    });
    return;
  }

  const targetBooking = (data ?? params.booking) as BookingRecord;

  try {
    await sendBookingPendingAttentionEmail(targetBooking, { reason: params.reason ?? "Insufficient capacity" });
    params.logJob("pending_admin.notified", { bookingId: params.booking.id, reason: params.reason ?? null });
  } catch (notifyError) {
    console.error("[auto-assign] failed to send pending admin email", {
      bookingId: params.booking.id,
      error: notifyError,
    });
  }
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
    const { data: bookingRow, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    let booking: Tables<"bookings"> | null = null;

    if (bookingError) {
      console.error("[auto-assign] booking lookup failed", { bookingId, error: bookingError?.message ?? bookingError });
      logJob("failed.lookup", { error: bookingError?.message ?? bookingError });
      return;
    } else if (!bookingRow) {
      console.error("[auto-assign] booking lookup failed", { bookingId, error: "not_found" });
      logJob("failed.lookup", { error: "not_found" });
      return;
    } else {
      booking = bookingRow as Tables<"bookings">;
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

    const { data: latestBooking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    const bookingForNotification = (latestBooking ?? booking) as Tables<"bookings">;
    const notificationReason = hardStopReason ?? inlineLastResult?.reason ?? null;

    await maybeNotifyAdminPending({
      booking: bookingForNotification,
      supabase,
      reason: notificationReason,
      suppressEmails: SUPPRESS_EMAILS,
      logJob,
    });
  } catch (e) {
    if (emitAutoAssignSummary) {
      await emitAutoAssignSummary("error", attempt);
    }
    console.error("[auto-assign] unexpected error", { bookingId, error: e });
    logJob("failed.unexpected", { error: e instanceof Error ? e.message : String(e) });
  }
}
