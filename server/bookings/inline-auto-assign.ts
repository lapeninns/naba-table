import { randomUUID } from 'node:crypto';

import { CancellableAutoAssign } from '@/server/booking/auto-assign/cancellable-auto-assign';
import { type BookingRecord, updateBookingRecord } from '@/server/bookings';
import { buildInlineLastResult } from '@/server/capacity/auto-assign-last-result';
import { classifyPlannerReason } from '@/server/capacity/planner-reason';
import { recordPlannerQuoteTelemetry } from '@/server/capacity/planner-telemetry';
import { quoteTablesForBooking, atomicConfirmAndTransition } from '@/server/capacity/tables';
import { recordObservabilityEvent } from '@/server/observability';
import { getInlineAutoAssignTimeoutMs } from '@/server/runtime-policy';

import type { SupabaseClient } from '@supabase/supabase-js';

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function attemptInlineAutoAssign(
  supabase: SupabaseClient,
  initialBooking: BookingRecord,
  restaurantId: string,
): Promise<BookingRecord> {
  let finalBooking = initialBooking;
  const inlineTimeoutMs = getInlineAutoAssignTimeoutMs();
  const inlineAttemptId = randomUUID();
  let inlineAttemptStartedAt = 0;
  const inlinePlannerStrategy = { requireAdjacency: null, maxTables: null };
  const inlinePlannerTrigger = 'inline_creation';
  const inlineEmailVariant = 'standard';
  let inlineTimeoutPersisted = false;

  const persistInlinePlanResult = async (params: {
    success: boolean;
    reason: string | null;
    durationMs: number;
    alternates?: number;
    emailSent: boolean;
    emailVariant: 'standard' | 'modified' | null;
  }) => {
    const inlineResult = buildInlineLastResult({
      durationMs: params.durationMs,
      success: params.success,
      reason: params.reason,
      strategy: inlinePlannerStrategy,
      trigger: inlinePlannerTrigger,
      alternates: params.alternates,
      attemptId: inlineAttemptId,
      emailSent: params.emailSent,
      emailVariant: params.emailVariant,
    });
    try {
      finalBooking = (await updateBookingRecord(supabase, finalBooking.id, {
        auto_assign_last_result: inlineResult,
      })) as BookingRecord;
    } catch (updateError) {
      console.warn('[bookings][inline-auto-assign] persist inline result failed', {
        bookingId: finalBooking.id,
        error: stringifyError(updateError),
      });
    }
  };

  try {
    const inlineIdempotencyKey =
      finalBooking.auto_assign_idempotency_key ?? `api-${finalBooking.id}`;
    const autoAssign = new CancellableAutoAssign(inlineTimeoutMs);
    inlineAttemptStartedAt = Date.now();

    console.info('[bookings][inline-auto-assign] start', {
      bookingId: finalBooking.id,
      attemptId: inlineAttemptId,
      timeoutMs: inlineTimeoutMs,
    });

    const handleInlineTimeout = async () => {
      const elapsedMs =
        inlineAttemptStartedAt > 0 ? Date.now() - inlineAttemptStartedAt : undefined;
      await recordObservabilityEvent({
        source: 'bookings.inline_auto_assign',
        eventType: 'inline_auto_assign.timeout',
        restaurantId: restaurantId as string,
        bookingId: finalBooking.id,
        context: {
          timeoutMs: inlineTimeoutMs,
          elapsedMs,
          attemptId: inlineAttemptId,
        },
        severity: 'warning',
      });
      await persistInlinePlanResult({
        success: false,
        reason: 'INLINE_TIMEOUT',
        durationMs: elapsedMs ?? inlineTimeoutMs,
        alternates: 0,
        emailSent: false,
        emailVariant: inlineEmailVariant,
      });
      inlineTimeoutPersisted = true;
    };

    await autoAssign.runWithTimeout(async (signal) => {
      const quoteStartedAt = Date.now();
      let quoteDurationMs = 0;
      let quote: Awaited<ReturnType<typeof quoteTablesForBooking>> | null = null;
      try {
        quote = await quoteTablesForBooking({
          bookingId: finalBooking.id,
          createdBy: 'api-booking',
          holdTtlSeconds: 120,
          signal,
        });
        quoteDurationMs = Date.now() - quoteStartedAt;
        const classification = classifyPlannerReason(quote?.reason ?? null);
        await recordPlannerQuoteTelemetry({
          restaurantId: restaurantId,
          bookingId: finalBooking.id,
          durationMs: quoteDurationMs,
          success: Boolean(quote?.hold),
          reason: quote?.reason ?? null,
          reasonCode: classification.code,
          reasonCategory: classification.category,
          strategy: inlinePlannerStrategy,
          trigger: inlinePlannerTrigger,
          attemptIndex: 0,
          internalStats: quote?.plannerStats ?? null,
          extraContext: { attemptId: inlineAttemptId },
        });
      } catch (quoteError) {
        quoteDurationMs = Date.now() - quoteStartedAt;
        const inlineQuoteErrorReason =
          quoteError instanceof Error && quoteError.name ? quoteError.name : 'QUOTE_ERROR';
        const classification = classifyPlannerReason(inlineQuoteErrorReason);
        await persistInlinePlanResult({
          success: false,
          reason: inlineQuoteErrorReason,
          durationMs: quoteDurationMs,
          alternates: 0,
          emailSent: false,
          emailVariant: inlineEmailVariant,
        });
        await recordPlannerQuoteTelemetry({
          restaurantId,
          bookingId: finalBooking.id,
          durationMs: quoteDurationMs,
          success: false,
          reason: inlineQuoteErrorReason,
          reasonCode: classification.code,
          reasonCategory: classification.category,
          strategy: inlinePlannerStrategy,
          trigger: inlinePlannerTrigger,
          attemptIndex: 0,
          errorMessage: stringifyError(quoteError),
          severity: 'warning',
          extraContext: { attemptId: inlineAttemptId },
        });
        console.error('[bookings][inline-auto-assign] quote error', {
          bookingId: finalBooking.id,
          attemptId: inlineAttemptId,
          durationMs: quoteDurationMs,
          error: stringifyError(quoteError),
        });
        await recordObservabilityEvent({
          source: 'bookings.inline_auto_assign',
          eventType: 'inline_auto_assign.quote_error',
          restaurantId,
          bookingId: finalBooking.id,
          context: {
            durationMs: quoteDurationMs,
            attemptId: inlineAttemptId,
          },
          severity: 'warning',
        });
        throw quoteError;
      }

      console.info('[bookings][inline-auto-assign] quote result', {
        bookingId: finalBooking.id,
        attemptId: inlineAttemptId,
        durationMs: quoteDurationMs,
        hasHold: Boolean(quote?.hold),
        reason: quote?.reason ?? null,
        alternates: quote?.alternates?.length ?? 0,
      });

      await recordObservabilityEvent({
        source: 'bookings.inline_auto_assign',
        eventType: 'inline_auto_assign.quote_result',
        restaurantId,
        bookingId: finalBooking.id,
        context: {
          durationMs: quoteDurationMs,
          hasHold: Boolean(quote?.hold),
          attemptId: inlineAttemptId,
          reason: quote?.reason ?? null,
          alternates: quote?.alternates?.length ?? 0,
        },
      });

      if (!quote?.hold) {
        await persistInlinePlanResult({
          success: false,
          reason: quote?.reason ?? null,
          alternates: quote?.alternates?.length ?? 0,
          durationMs: quoteDurationMs,
          emailSent: false,
          emailVariant: inlineEmailVariant,
        });
        console.warn('[bookings][inline-auto-assign] hold not available', {
          bookingId: finalBooking.id,
          reason: quote?.reason ?? 'NO_HOLD',
          alternates: quote?.alternates?.length ?? 0,
          attemptId: inlineAttemptId,
          durationMs: quoteDurationMs,
        });
        await recordObservabilityEvent({
          source: 'bookings.inline_auto_assign',
          eventType: 'inline_auto_assign.no_hold',
          restaurantId,
          bookingId: finalBooking.id,
          context: {
            reason: quote?.reason ?? 'NO_HOLD',
            alternates: quote?.alternates?.length ?? 0,
            durationMs: quoteDurationMs,
            attemptId: inlineAttemptId,
          },
          severity: 'info',
        });
        return;
      }

      const confirmStartedAt = Date.now();
      try {
        await atomicConfirmAndTransition({
          bookingId: finalBooking.id,
          holdId: quote.hold.id,
          idempotencyKey: inlineIdempotencyKey,
          assignedBy: null,
          historyReason: 'api_inline_auto_assign',
          historyMetadata: { source: 'api-inline', holdId: quote.hold.id },
          signal,
        });
      } catch (confirmError) {
        const confirmDurationMs = Date.now() - confirmStartedAt;
        const confirmErrorString = stringifyError(confirmError);
        const normalizedConfirmError = confirmErrorString.toLowerCase();
        const isOverlap = normalizedConfirmError.includes('allocations_no_overlap');

        console.error('[bookings][inline-auto-assign] confirm error', {
          bookingId: finalBooking.id,
          attemptId: inlineAttemptId,
          holdId: quote.hold.id,
          durationMs: confirmDurationMs,
          idempotencyKey: inlineIdempotencyKey,
          error: confirmErrorString,
        });
        await recordObservabilityEvent({
          source: 'bookings.inline_auto_assign',
          eventType: 'inline_auto_assign.confirm_failed',
          restaurantId,
          bookingId: finalBooking.id,
          context: {
            attemptId: inlineAttemptId,
            holdId: quote.hold.id,
            durationMs: confirmDurationMs,
            idempotencyKey: inlineIdempotencyKey,
            reason: confirmErrorString,
          },
          severity: 'error',
        });

        if (isOverlap) {
          await persistInlinePlanResult({
            success: false,
            reason: 'allocations_no_overlap',
            alternates: quote?.alternates?.length ?? 0,
            durationMs: quoteDurationMs,
            emailSent: false,
            emailVariant: inlineEmailVariant,
          });
          await recordObservabilityEvent({
            source: 'bookings.inline_auto_assign',
            eventType: 'inline_auto_assign.confirm_overlap',
            restaurantId,
            bookingId: finalBooking.id,
            context: {
              attemptId: inlineAttemptId,
              holdId: quote.hold.id,
              durationMs: confirmDurationMs,
              idempotencyKey: inlineIdempotencyKey,
            },
            severity: 'warning',
          });
          return;
        }

        throw confirmError;
      }

      const confirmDurationMs = Date.now() - confirmStartedAt;
      console.info('[bookings][inline-auto-assign] confirm completed', {
        bookingId: finalBooking.id,
        attemptId: inlineAttemptId,
        holdId: quote.hold.id,
        durationMs: confirmDurationMs,
      });

      await recordObservabilityEvent({
        source: 'bookings.inline_auto_assign',
        eventType: 'inline_auto_assign.confirm_succeeded',
        restaurantId,
        bookingId: finalBooking.id,
        context: {
          attemptId: inlineAttemptId,
          holdId: quote.hold.id,
          durationMs: confirmDurationMs,
        },
      });

      const { data: reloaded } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', finalBooking.id)
        .maybeSingle();

      if (reloaded) {
        finalBooking = reloaded as BookingRecord;
      }

      // Telemetry-integrity guard: a confirm that completes just after the 4s
      // inline timeout already fired must NOT overwrite the persisted
      // INLINE_TIMEOUT record with success:true. Doing so loses the timeout
      // signal (corrupting retry telemetry) and triggers redundant background
      // jobs that key off auto_assign_last_result. Booking correctness is
      // unaffected — the confirm did consume the hold — so we keep the timeout
      // record and only log that a late success arrived. Mirrors the ERROR and
      // abort paths, which already gate their persists on inlineTimeoutPersisted.
      if (inlineTimeoutPersisted) {
        console.warn(
          '[bookings][inline-auto-assign] late confirm success after inline timeout; preserving timeout result',
          {
            bookingId: finalBooking.id,
            attemptId: inlineAttemptId,
            holdId: quote.hold.id,
            confirmDurationMs,
            timeoutMs: inlineTimeoutMs,
          },
        );
      } else {
        await persistInlinePlanResult({
          success: true,
          reason: quote.reason ?? null,
          alternates: quote?.alternates?.length ?? 0,
          durationMs: quoteDurationMs,
          emailSent: false,
          emailVariant: inlineEmailVariant,
        });
      }

      await recordObservabilityEvent({
        source: 'bookings.inline_auto_assign',
        eventType: 'inline_auto_assign.succeeded',
        restaurantId,
        bookingId: finalBooking.id,
        context: {
          holdId: quote.hold.id,
          idempotencyKey: inlineIdempotencyKey,
          attemptId: inlineAttemptId,
          quoteDurationMs,
          confirmDurationMs,
        },
      });
    }, handleInlineTimeout);
  } catch (inlineError) {
    if (inlineError instanceof Error && inlineError.name === 'AbortError') {
      const durationMs =
        inlineAttemptStartedAt > 0 ? Date.now() - inlineAttemptStartedAt : undefined;
      console.warn('[bookings][inline-auto-assign] aborted', {
        bookingId: finalBooking.id,
        durationMs,
        timeoutMs: inlineTimeoutMs,
        attemptId: inlineAttemptId,
      });
      if (!inlineTimeoutPersisted) {
        await persistInlinePlanResult({
          success: false,
          reason: 'INLINE_TIMEOUT',
          durationMs: durationMs ?? inlineTimeoutMs,
          alternates: 0,
          emailSent: false,
          emailVariant: inlineEmailVariant,
        });
        inlineTimeoutPersisted = true;
      }
      await recordObservabilityEvent({
        source: 'bookings.inline_auto_assign',
        eventType: 'inline_auto_assign.operation_aborted',
        restaurantId,
        bookingId: finalBooking.id,
        context: {
          attemptId: inlineAttemptId,
          durationMs,
          timeoutMs: inlineTimeoutMs,
        },
        severity: 'warning',
      });
    } else {
      console.warn('[bookings][inline-auto-assign] failed', { error: stringifyError(inlineError) });
    }
  }

  return finalBooking;
}
