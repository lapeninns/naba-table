import { randomUUID } from "node:crypto";

import { getVenuePolicy } from "@/server/capacity/policy";
import { atomicConfirmAndTransition, computeBookingWindowWithFallback } from "@/server/capacity/table-assignment";
import {
  getAssignmentPipelineMaxConcurrentPerRestaurant,
  isAssignmentPipelineV3Enabled,
  isAssignmentPipelineV3ShadowMode,
} from "@/server/feature-flags";
import { recordObservabilityEvent, type ObservabilitySeverity } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";


import { SmartAssignmentEngine, type AssignmentEngineConfig } from "./assignment-engine";
import { TableAvailabilityTracker } from "./availability-tracker";
import { CircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker";
import { DistributedLockManager } from "./distributed-lock-manager";
import { RateLimiter, RateLimitExceededError } from "./rate-limiter";
import { BookingStateMachine, StateTransitionError } from "./state-machine";
import { BookingAssignmentState } from "./states";

import type { AssignmentAttempt, AssignmentResult, BookingWithAssignmentState, TimeSlot } from "./types";
import type { Database, Json } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AssignmentCoordinatorResult =
  | { outcome: "confirmed"; strategy: string; holdId: string }
  | { outcome: "retry"; reason: string; delayMs: number }
  | { outcome: "manual_review"; reason: string }
  | { outcome: "noop"; reason: string };

export type AssignmentCoordinatorFailureResult = Exclude<AssignmentCoordinatorResult, { outcome: "confirmed" }>;

export type AssignmentCoordinatorConfig = {
  lockTtlMs?: number;
  maxRetries?: number;
  assignmentEngine?: AssignmentEngineConfig;
  circuitBreaker?: { failureThreshold?: number; cooldownMs?: number; halfOpenSuccesses?: number };
};

const ASSIGNMENT_HISTORY_REASON = "assignment.auto_confirmed";
const COORDINATOR_EVENT_SOURCE = "assignment.coordinator";

export class AssignmentCoordinator {
  private readonly supabase: SupabaseClient<Database>;
  private readonly lockManager: DistributedLockManager;
  private readonly stateMachine: BookingStateMachine;
  private readonly engine: SmartAssignmentEngine;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: RateLimiter;

  constructor(private readonly config: AssignmentCoordinatorConfig = {}) {
    this.supabase = getServiceSupabaseClient();
    const tracker = new TableAvailabilityTracker(this.supabase);
    this.engine = new SmartAssignmentEngine(this.config.assignmentEngine ?? {}, { tracker, supabase: this.supabase });
    this.lockManager = new DistributedLockManager();
    this.stateMachine = new BookingStateMachine(this.supabase);
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    this.rateLimiter = new RateLimiter(getAssignmentPipelineMaxConcurrentPerRestaurant());
  }

  async processBooking(bookingId: string, trigger: string): Promise<AssignmentCoordinatorResult> {
    const pipelineEnabled = isAssignmentPipelineV3Enabled();
    const shadowMode = isAssignmentPipelineV3ShadowMode();
    const mode = pipelineEnabled ? "active" : shadowMode ? "shadow" : "disabled";
    const startedAt = Date.now();
    let lastRestaurantId: string | null = null;

    emitCoordinatorEvent("coordinator.start", {
      bookingId,
      trigger,
      details: { mode },
    });

    if (!pipelineEnabled && !shadowMode) {
      emitCoordinatorEvent("coordinator.noop", {
        bookingId,
        trigger,
        details: { reason: "pipeline_disabled" },
      });
      return { outcome: "noop", reason: "pipeline_disabled" };
    }

    const lock = await this.lockManager.acquireLock(`booking:${bookingId}`, this.config.lockTtlMs ?? 30_000);
    if (!lock) {
      emitCoordinatorEvent("coordinator.lock_contention", {
        bookingId,
        trigger,
        severity: "warning",
      });
      return { outcome: "noop", reason: "lock_contention" };
    }

    emitCoordinatorEvent("coordinator.lock_acquired", {
      bookingId,
      trigger,
      details: { ttl_ms: this.config.lockTtlMs ?? 30_000 },
    });

    if (this.circuitBreaker.isOpen()) {
      const delayMs = Math.max(1_000, this.circuitBreaker.remainingCooldownMs() || 5_000);
      emitCoordinatorEvent("coordinator.circuit_open", {
        bookingId,
        trigger,
        severity: "warning",
        details: { delay_ms: delayMs },
      });
      await lock.release();
      return {
        outcome: "retry",
        reason: "circuit_open",
        delayMs,
      };
    }

    try {
      return await this.circuitBreaker.execute(async () => {
        const booking = await this.loadBooking(bookingId);
        if (!booking) {
          emitCoordinatorEvent("coordinator.noop", {
            bookingId,
            trigger,
            severity: "warning",
            details: { reason: "booking_not_found" },
          });
          return { outcome: "noop", reason: "booking_not_found" };
        }

        lastRestaurantId = booking.restaurant_id;

        if (!this.stateMachine.canProcess(booking.assignment_state as BookingAssignmentState)) {
          emitCoordinatorEvent("coordinator.noop", {
            bookingId,
            restaurantId: booking.restaurant_id,
            trigger,
            severity: "warning",
            details: { reason: "terminal_state" },
          });
          return { outcome: "noop", reason: "terminal_state" };
        }

        await this.ensureReadyState(booking);

        const ratePermit = await this.acquireRateLimit(booking.restaurant_id);
        emitCoordinatorEvent("coordinator.rate_permit_acquired", {
          bookingId,
          restaurantId: booking.restaurant_id,
          trigger,
        });
        try {
          await this.stateMachine.transition(booking, BookingAssignmentState.ASSIGNMENT_IN_PROGRESS, { trigger });
          const timeSlot = this.computeTimeSlot(booking);
          const context = await this.engine.buildContext(booking, timeSlot);
          const result = await this.engine.findOptimalAssignment(context);
          if (result.success) {
            await this.recordAttempts(booking.id, result.attempts, true, null);
            await this.stateMachine.transition(booking, BookingAssignmentState.ASSIGNED, {
              strategy: result.strategy,
              planId: result.plan.id,
            });
            await this.confirmAssignment(booking, result, trigger);
            await this.stateMachine.transition(booking, BookingAssignmentState.CONFIRMED, {
              strategy: result.strategy,
            });

            emitCoordinatorEvent("coordinator.confirmed", {
              bookingId,
              restaurantId: booking.restaurant_id,
              trigger,
              details: {
                strategy: result.strategy,
                attempts: result.attempts.length,
                duration_ms: Date.now() - startedAt,
              },
            });

            return { outcome: "confirmed", strategy: result.strategy, holdId: result.assignment.holdId };
          }

          await this.recordAttempts(booking.id, result.attempts, false, result.reason);
          const failure = await this.handleAssignmentFailure(booking, result.reason ?? "no_assignment");
          const baseDetails = {
            reason: failure.reason,
            duration_ms: Date.now() - startedAt,
            attempts: result.attempts.length,
          } as Record<string, unknown>;
          if (failure.outcome === "manual_review") {
            emitCoordinatorEvent("coordinator.manual_review", {
              bookingId,
              restaurantId: booking.restaurant_id,
              trigger,
              details: baseDetails,
            });
          } else if (failure.outcome === "retry") {
            emitCoordinatorEvent("coordinator.retry", {
              bookingId,
              restaurantId: booking.restaurant_id,
              trigger,
              severity: "warning",
              details: {
                ...baseDetails,
                delay_ms: failure.delayMs,
              },
            });
          }
          return failure;
        } finally {
          ratePermit.release();
        }
      });
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        emitCoordinatorEvent("coordinator.circuit_open", {
          bookingId,
          restaurantId: lastRestaurantId,
          trigger,
          severity: "warning",
          details: { delay_ms: error.retryAfterMs },
        });
        return { outcome: "retry", reason: "circuit_open", delayMs: error.retryAfterMs };
      }
      if (error instanceof RateLimitExceededError) {
        emitCoordinatorEvent("coordinator.retry", {
          bookingId,
          restaurantId: lastRestaurantId,
          trigger,
          severity: "warning",
          details: { reason: "rate_limited", delay_ms: 2_000 },
        });
        return { outcome: "retry", reason: "rate_limited", delayMs: 2_000 };
      }
      emitCoordinatorEvent("coordinator.error", {
        bookingId,
        restaurantId: lastRestaurantId,
        trigger,
        severity: "error",
        details: { message: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    } finally {
      await lock.release();
    }
  }

  private async loadBooking(bookingId: string): Promise<BookingWithAssignmentState | null> {
    const { data, error } = await this.supabase
      .from("bookings")
      .select(
        [
          "*",
          "restaurants(timezone,slug)",
        ].join(","),
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return data as unknown as BookingWithAssignmentState;
  }

  private async ensureReadyState(booking: BookingWithAssignmentState): Promise<void> {
    const currentState = (booking.assignment_state as BookingAssignmentState | null) ?? BookingAssignmentState.CREATED;
    if (currentState === BookingAssignmentState.CREATED) {
      await this.stateMachine.transition(booking, BookingAssignmentState.CAPACITY_VERIFIED, { reason: "auto" });
    }
    if ((booking.assignment_state as BookingAssignmentState | null) === BookingAssignmentState.CAPACITY_VERIFIED) {
      await this.stateMachine.transition(booking, BookingAssignmentState.ASSIGNMENT_PENDING, { reason: "auto" });
    }
  }

  private computeTimeSlot(booking: BookingWithAssignmentState): TimeSlot {
    const timezone = Array.isArray(booking.restaurants)
      ? booking.restaurants[0]?.timezone
      : (booking.restaurants as { timezone: string | null } | null)?.timezone;
    const policy = getVenuePolicy({ timezone: timezone ?? undefined });
    const { window } = computeBookingWindowWithFallback({
      startISO: booking.start_at,
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      partySize: booking.party_size,
      policy,
    });
    const startIso =
      window.block.start.toUTC().toISO() ??
      window.block.start.toUTC().toISO({ suppressMilliseconds: true }) ??
      window.block.start.toUTC().toString();
    const endIso =
      window.block.end.toUTC().toISO() ??
      window.block.end.toUTC().toISO({ suppressMilliseconds: true }) ??
      window.block.end.toUTC().toString();
    return {
      start: startIso,
      end: endIso,
    };
  }

  private async confirmAssignment(
    booking: BookingWithAssignmentState,
    result: Extract<AssignmentResult, { success: true }>,
    trigger: string,
  ): Promise<void> {
    const idempotencyKey = randomUUID();
    await atomicConfirmAndTransition({
      bookingId: booking.id,
      holdId: result.assignment.holdId,
      idempotencyKey,
      assignedBy: null,
      historyReason: ASSIGNMENT_HISTORY_REASON,
      historyMetadata: {
        strategy: result.strategy,
        trigger,
      },
    });

    await this.supabase
      .from("bookings")
      .update({ assignment_strategy: result.strategy })
      .eq("id", booking.id);
  }

  private async recordAttempts(
    bookingId: string,
    attempts: AssignmentAttempt[],
    succeeded: boolean,
    reason: string | null,
  ): Promise<void> {
    if (attempts.length === 0) {
      return;
    }
    const nextAttempt = await this.nextAttemptNumber(bookingId);
    const rows = attempts.map((attempt, index) => ({
      booking_id: bookingId,
      attempt_no: nextAttempt + index,
      strategy: attempt.strategy,
      result: succeeded && index === attempts.length - 1 ? "success" : "failure",
      reason: index === attempts.length - 1 ? reason : null,
      metadata: {
        slack: attempt.plan.slack,
        tableCount: attempt.plan.tables.length,
        zoneId: attempt.plan.zoneId,
        score: attempt.score,
      } as Json,
    }));
    await this.supabase.from("booking_assignment_attempts").insert(rows);
  }

  private async nextAttemptNumber(bookingId: string): Promise<number> {
    const { data } = await this.supabase
      .from("booking_assignment_attempts")
      .select("attempt_no")
      .eq("booking_id", bookingId)
      .order("attempt_no", { ascending: false })
      .limit(1);
    if (!Array.isArray(data) || data.length === 0) {
      return 1;
    }
    const latest = data[0]?.attempt_no ?? 0;
    return latest + 1;
  }

  private async handleAssignmentFailure(
    booking: BookingWithAssignmentState,
    reason: string,
  ): Promise<AssignmentCoordinatorFailureResult> {
    const attemptCount = await this.countAttempts(booking.id);
    const maxRetries = this.config.maxRetries ?? 5;
    if (attemptCount >= maxRetries) {
      try {
        await this.stateMachine.transition(booking, BookingAssignmentState.MANUAL_REVIEW, { reason });
      } catch (error) {
        if (!(error instanceof StateTransitionError)) {
          throw error;
        }
      }
      return { outcome: "manual_review", reason };
    }

    try {
      await this.stateMachine.transition(booking, BookingAssignmentState.ASSIGNMENT_PENDING, { reason });
    } catch (error) {
      if (!(error instanceof StateTransitionError)) {
        throw error;
      }
    }

    const delay = Math.min(30_000, 1_000 * Math.pow(2, attemptCount) + Math.random() * 1_000);
    return { outcome: "retry", reason, delayMs: Math.round(delay) };
  }

  private async countAttempts(bookingId: string): Promise<number> {
    const { count } = await this.supabase
      .from("booking_assignment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bookingId);
    return count ?? 0;
  }

  private async acquireRateLimit(restaurantId: string): Promise<{ release: () => void }> {
    try {
      return await this.rateLimiter.consume(restaurantId);
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        throw error;
      }
      throw new RateLimitExceededError(restaurantId);
    }
  }

}

export type CoordinatorEventParams = {
  bookingId?: string;
  restaurantId?: string | null;
  trigger?: string | null;
  details?: Record<string, unknown>;
  severity?: ObservabilitySeverity;
};

export function emitCoordinatorEvent(eventType: string, params: CoordinatorEventParams): void {
  const context: Record<string, unknown> = {};
  if (params.trigger) {
    context.trigger = params.trigger;
  }
  if (params.details) {
    Object.assign(context, params.details);
  }
  const hasContext = Object.keys(context).length > 0;
  recordObservabilityEvent({
    source: COORDINATOR_EVENT_SOURCE,
    eventType,
    bookingId: params.bookingId ?? null,
    restaurantId: params.restaurantId ?? null,
    severity: params.severity,
    context: hasContext ? (context as Json) : null,
  }).catch(() => {
    /* noop */
  });
}
