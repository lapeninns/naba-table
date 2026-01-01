import { randomUUID } from 'crypto';

import { CancellableAutoAssign } from '@/server/booking/auto-assign/cancellable-auto-assign';
import { updateBookingRecord, type BookingRecord } from '@/server/bookings';
import { classifyPlannerReason } from '@/server/capacity/planner-reason';
import { recordPlannerQuoteTelemetry } from '@/server/capacity/planner-telemetry';
import { quoteTablesForBooking, atomicConfirmAndTransition } from '@/server/capacity/tables';
import { recordObservabilityEvent } from '@/server/observability';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database, 'public'>;

function stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

export type InlineAutoAssignOptions = {
    bookingId: string;
    restaurantId: string;
    timeoutMs?: number;
    createdBy: string;
    historyReason: string;
    observabilitySource: string;
    client: DbClient;
    onBookingUpdated?: (booking: BookingRecord) => void;
};

type InlineLastResult = {
    attemptId: string;
    attemptedAt: string;
    success: boolean;
    reason: string | null;
    durationMs: number;
    strategy: { requireAdjacency: null; maxTables: null };
    trigger: string;
    alternates?: number;
    emailSent: boolean;
    emailVariant: 'standard' | 'modified' | null;
};

function buildInlineLastResult(params: {
    durationMs: number;
    success: boolean;
    reason: string | null;
    strategy: { requireAdjacency: null; maxTables: null };
    trigger: string;
    alternates?: number;
    attemptId: string;
    emailSent: boolean;
    emailVariant: 'standard' | 'modified' | null;
}): InlineLastResult {
    return {
        attemptId: params.attemptId,
        attemptedAt: new Date().toISOString(),
        success: params.success,
        reason: params.reason,
        durationMs: params.durationMs,
        strategy: params.strategy,
        trigger: params.trigger,
        alternates: params.alternates,
        emailSent: params.emailSent,
        emailVariant: params.emailVariant,
    };
}

/**
 * Performs inline auto-assignment for a booking with timeout control and full observability.
 * This is the unified implementation used by both public and ops booking endpoints.
 * 
 * Returns the updated booking record if assignment succeeds and modifies the booking status.
 * Returns null if assignment times out or fails (booking remains in current state).
 */
export async function runInlineAutoAssign(
    options: InlineAutoAssignOptions
): Promise<BookingRecord | null> {
    const {
        bookingId,
        restaurantId,
        timeoutMs = 4000,
        createdBy,
        historyReason,
        observabilitySource,
        client: supabase,
        onBookingUpdated,
    } = options;

    const attemptId = randomUUID();
    let attemptStartedAt = 0;
    const plannerStrategy = { requireAdjacency: null, maxTables: null };
    const plannerTrigger = 'inline_creation';
    const emailVariant = 'standard';
    let timeoutPersisted = false;
    let currentBooking: BookingRecord | null = null;

    const persistInlinePlanResult = async (params: {
        success: boolean;
        reason: string | null;
        durationMs: number;
        alternates?: number;
        emailSent: boolean;
        emailVariant: 'standard' | 'modified' | null;
    }) => {
        const inlineResult: Json = buildInlineLastResult({
            durationMs: params.durationMs,
            success: params.success,
            reason: params.reason,
            strategy: plannerStrategy,
            trigger: plannerTrigger,
            alternates: params.alternates,
            attemptId,
            emailSent: params.emailSent,
            emailVariant: params.emailVariant,
        });
        try {
            const updated = await updateBookingRecord(supabase, bookingId, {
                auto_assign_last_result: inlineResult,
            });
            currentBooking = updated;
            if (onBookingUpdated) {
                onBookingUpdated(updated);
            }
        } catch (updateError) {
            console.warn('[inline-auto-assign] persist inline result failed', {
                bookingId,
                error: stringifyError(updateError),
            });
        }
    };

    try {
        const inlineIdempotencyKey = `inline-${bookingId}`;
        const autoAssign = new CancellableAutoAssign(timeoutMs);
        attemptStartedAt = Date.now();

        console.info('[inline-auto-assign] start', {
            bookingId,
            attemptId,
            timeoutMs,
            createdBy,
        });

        const handleInlineTimeout = async () => {
            const elapsedMs = attemptStartedAt > 0 ? Date.now() - attemptStartedAt : undefined;
            await recordObservabilityEvent({
                source: observabilitySource,
                eventType: 'inline_auto_assign.timeout',
                restaurantId,
                bookingId,
                context: {
                    timeoutMs,
                    elapsedMs,
                    attemptId,
                },
                severity: 'warning',
            });
            await persistInlinePlanResult({
                success: false,
                reason: 'INLINE_TIMEOUT',
                durationMs: elapsedMs ?? timeoutMs,
                alternates: 0,
                emailSent: false,
                emailVariant,
            });
            timeoutPersisted = true;
        };

        await autoAssign.runWithTimeout(async (signal: AbortSignal) => {
            const quoteStartedAt = Date.now();
            let quoteDurationMs = 0;
            let quote: Awaited<ReturnType<typeof quoteTablesForBooking>> | null = null;

            try {
                quote = await quoteTablesForBooking({
                    bookingId,
                    createdBy,
                    holdTtlSeconds: 120,
                    client: supabase,
                    signal,
                });
                quoteDurationMs = Date.now() - quoteStartedAt;
                const classification = classifyPlannerReason(quote?.reason ?? null);
                await recordPlannerQuoteTelemetry({
                    restaurantId,
                    bookingId,
                    durationMs: quoteDurationMs,
                    success: Boolean(quote?.hold),
                    reason: quote?.reason ?? null,
                    reasonCode: classification.code,
                    reasonCategory: classification.category,
                    strategy: plannerStrategy,
                    trigger: plannerTrigger,
                    attemptIndex: 0,
                    internalStats: quote?.plannerStats ?? null,
                    extraContext: { attemptId },
                });
            } catch (quoteError) {
                quoteDurationMs = Date.now() - quoteStartedAt;
                const quoteErrorReason =
                    quoteError instanceof Error && quoteError.name ? quoteError.name : 'QUOTE_ERROR';
                const classification = classifyPlannerReason(quoteErrorReason);
                await persistInlinePlanResult({
                    success: false,
                    reason: quoteErrorReason,
                    durationMs: quoteDurationMs,
                    alternates: 0,
                    emailSent: false,
                    emailVariant,
                });
                await recordPlannerQuoteTelemetry({
                    restaurantId,
                    bookingId,
                    durationMs: quoteDurationMs,
                    success: false,
                    reason: quoteErrorReason,
                    reasonCode: classification.code,
                    reasonCategory: classification.category,
                    strategy: plannerStrategy,
                    trigger: plannerTrigger,
                    attemptIndex: 0,
                    errorMessage: stringifyError(quoteError),
                    severity: 'warning',
                    extraContext: { attemptId },
                });
                console.error('[inline-auto-assign] quote error', {
                    bookingId,
                    attemptId,
                    durationMs: quoteDurationMs,
                    error: stringifyError(quoteError),
                });
                await recordObservabilityEvent({
                    source: observabilitySource,
                    eventType: 'inline_auto_assign.quote_error',
                    restaurantId,
                    bookingId,
                    context: {
                        durationMs: quoteDurationMs,
                        attemptId,
                    },
                    severity: 'warning',
                });
                throw quoteError;
            }

            console.info('[inline-auto-assign] quote result', {
                bookingId,
                attemptId,
                durationMs: quoteDurationMs,
                hasHold: Boolean(quote?.hold),
                reason: quote?.reason ?? null,
                alternates: quote?.alternates?.length ?? 0,
            });

            await recordObservabilityEvent({
                source: observabilitySource,
                eventType: 'inline_auto_assign.quote_result',
                restaurantId,
                bookingId,
                context: {
                    durationMs: quoteDurationMs,
                    hasHold: Boolean(quote?.hold),
                    attemptId,
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
                    emailVariant,
                });
                console.warn('[inline-auto-assign] hold not available', {
                    bookingId,
                    reason: quote?.reason ?? 'NO_HOLD',
                    alternates: quote?.alternates?.length ?? 0,
                    attemptId,
                    durationMs: quoteDurationMs,
                });
                await recordObservabilityEvent({
                    source: observabilitySource,
                    eventType: 'inline_auto_assign.no_hold',
                    restaurantId,
                    bookingId,
                    context: {
                        reason: quote?.reason ?? 'NO_HOLD',
                        alternates: quote?.alternates?.length ?? 0,
                        durationMs: quoteDurationMs,
                        attemptId,
                    },
                    severity: 'info',
                });
                return;
            }

            const confirmStartedAt = Date.now();
            try {
                await atomicConfirmAndTransition({
                    bookingId,
                    holdId: quote.hold.id,
                    idempotencyKey: inlineIdempotencyKey,
                    assignedBy: null,
                    historyReason,
                    historyMetadata: { source: createdBy, holdId: quote.hold.id },
                    client: supabase,
                    signal,
                });
            } catch (confirmError) {
                const confirmDurationMs = Date.now() - confirmStartedAt;
                console.error('[inline-auto-assign] confirm error', {
                    bookingId,
                    attemptId,
                    holdId: quote.hold.id,
                    durationMs: confirmDurationMs,
                    error: stringifyError(confirmError),
                });
                await recordObservabilityEvent({
                    source: observabilitySource,
                    eventType: 'inline_auto_assign.confirm_failed',
                    restaurantId,
                    bookingId,
                    context: {
                        attemptId,
                        holdId: quote.hold.id,
                        durationMs: confirmDurationMs,
                    },
                    severity: 'error',
                });
                throw confirmError;
            }

            const confirmDurationMs = Date.now() - confirmStartedAt;
            console.info('[inline-auto-assign] confirm completed', {
                bookingId,
                attemptId,
                holdId: quote.hold.id,
                durationMs: confirmDurationMs,
            });

            await recordObservabilityEvent({
                source: observabilitySource,
                eventType: 'inline_auto_assign.confirm_succeeded',
                restaurantId,
                bookingId,
                context: {
                    attemptId,
                    holdId: quote.hold.id,
                    durationMs: confirmDurationMs,
                },
            });

            // Reload booking to get updated status
            const { data: reloaded } = await supabase
                .from('bookings')
                .select('*')
                .eq('id', bookingId)
                .maybeSingle();

            if (reloaded) {
                currentBooking = reloaded as BookingRecord;
                if (onBookingUpdated) {
                    onBookingUpdated(currentBooking);
                }
            }

            await persistInlinePlanResult({
                success: true,
                reason: quote.reason ?? null,
                alternates: quote?.alternates?.length ?? 0,
                durationMs: quoteDurationMs,
                emailSent: false,
                emailVariant,
            });

            await recordObservabilityEvent({
                source: observabilitySource,
                eventType: 'inline_auto_assign.succeeded',
                restaurantId,
                bookingId,
                context: {
                    holdId: quote.hold.id,
                    idempotencyKey: inlineIdempotencyKey,
                    attemptId,
                    quoteDurationMs,
                    confirmDurationMs,
                },
            });
        }, handleInlineTimeout);

        return currentBooking;
    } catch (inlineError) {
        if (inlineError instanceof Error && inlineError.name === 'AbortError') {
            const durationMs = attemptStartedAt > 0 ? Date.now() - attemptStartedAt : undefined;
            console.warn('[inline-auto-assign] aborted', {
                bookingId,
                durationMs,
                timeoutMs,
                attemptId,
            });
            if (!timeoutPersisted) {
                await persistInlinePlanResult({
                    success: false,
                    reason: 'INLINE_TIMEOUT',
                    durationMs: durationMs ?? timeoutMs,
                    alternates: 0,
                    emailSent: false,
                    emailVariant,
                });
                timeoutPersisted = true;
            }
            await recordObservabilityEvent({
                source: observabilitySource,
                eventType: 'inline_auto_assign.operation_aborted',
                restaurantId,
                bookingId,
                context: {
                    attemptId,
                    durationMs,
                    timeoutMs,
                },
                severity: 'warning',
            });
        } else {
            console.warn('[inline-auto-assign] failed', {
                error: stringifyError(inlineError),
            });
        }
        return null;
    }
}
