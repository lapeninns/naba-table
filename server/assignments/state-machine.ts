import { recordObservabilityEvent } from "@/server/observability";
import { enqueueOutboxEvent } from "@/server/outbox";
import { getServiceSupabaseClient } from "@/server/supabase";

import { BookingAssignmentState, canTransition, TERMINAL_ASSIGNMENT_STATES } from "./states";

import type { BookingWithAssignmentState } from "./types";
import type { Database, Json } from "@/types/supabase";

export class StateTransitionError extends Error {
  constructor(message = "Invalid booking state transition") {
    super(message);
    this.name = "StateTransitionError";
  }
}

export class BookingStateMachine {
  constructor(private readonly supabase = getServiceSupabaseClient()) {}

  canProcess(state: BookingAssignmentState | null | undefined): boolean {
    if (!state) return true;
    return !TERMINAL_ASSIGNMENT_STATES.has(state);
  }

  async transition(
    booking: BookingWithAssignmentState,
    newState: BookingAssignmentState,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const currentState = (booking.assignment_state as BookingAssignmentState | null) ?? BookingAssignmentState.CREATED;
    if (currentState === newState) {
      return;
    }

    if (!canTransition(currentState, newState)) {
      throw new StateTransitionError(`Transition ${currentState} -> ${newState} not permitted`);
    }

    const currentVersion = typeof booking.assignment_state_version === "number" ? booking.assignment_state_version : 1;
    const nextVersion = currentVersion + 1;

    const { data: updated, error } = await this.supabase
      .from("bookings")
      .update({
        assignment_state: newState,
        assignment_state_version: nextVersion,
      })
      .eq("id", booking.id)
      .eq("assignment_state_version", currentVersion)
      .select("id, restaurant_id, assignment_state, assignment_state_version")
      .maybeSingle();

    if (error || !updated) {
      throw new StateTransitionError(
        error?.message ?? `Failed to persist transition ${currentState} -> ${newState} for booking ${booking.id}`,
      );
    }

    booking.assignment_state = newState as never;
    booking.assignment_state_version = nextVersion;

    const historyRow: Database["public"]["Tables"]["booking_assignment_state_history"]["Insert"] = {
      booking_id: booking.id,
      from_state: currentState,
      to_state: newState,
      actor_id: null,
      metadata: (metadata ?? {}) as Json,
    };

    await this.supabase.from("booking_assignment_state_history").insert(historyRow);

    const metadataJson = (metadata ?? null) as Json;

    recordObservabilityEvent({
      source: "assignment.state_machine",
      eventType: "booking.assignment_state_transition",
      restaurantId: updated.restaurant_id ?? undefined,
      bookingId: booking.id,
      context: {
        from: currentState,
        to: newState,
        version: nextVersion,
        metadata: metadataJson,
      },
    }).catch(() => {
      /* noop */
    });

    enqueueOutboxEvent({
      eventType: `booking.assignment_state.${newState}`,
      bookingId: booking.id,
      restaurantId: updated.restaurant_id ?? undefined,
      payload: {
        bookingId: booking.id,
        fromState: currentState,
        toState: newState,
        version: nextVersion,
        metadata: metadataJson,
      },
    }).catch(() => {
      /* noop */
    });
  }
}
