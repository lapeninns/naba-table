import { BOOKING_STATE_TRANSITIONS } from "@/config/booking-state-machine";
import type { Tables } from "@/types/supabase";

export type BookingStatus = Tables<"bookings">["status"];

const ALLOWED_TRANSITIONS: Readonly<Record<BookingStatus, ReadonlySet<BookingStatus>>> = Object.freeze(
  Object.entries(BOOKING_STATE_TRANSITIONS).reduce<Record<BookingStatus, ReadonlySet<BookingStatus>>>(
    (acc, [status, targets]) => {
      acc[status as BookingStatus] = new Set<BookingStatus>(targets as readonly BookingStatus[]);
      return acc;
    },
    {} as Record<BookingStatus, ReadonlySet<BookingStatus>>,
  ),
);

export type BookingLifecycleErrorCode =
  | "TRANSITION_NOT_ALLOWED"
  | "ALREADY_IN_STATE"
  | "UNKNOWN_STATUS"
  | "TIMESTAMP_INVALID"
  | "GRACE_PERIOD_EXPIRED"
  | "MISSING_HISTORY";

export class BookingLifecycleError extends Error {
  readonly code: BookingLifecycleErrorCode;
  constructor(message: string, code: BookingLifecycleErrorCode = "TRANSITION_NOT_ALLOWED") {
    super(message);
    this.code = code;
    this.name = "BookingLifecycleError";
  }
}

export type TransitionCheck = {
  from: BookingStatus;
  to: BookingStatus;
  allowSameState?: boolean;
};

export type TransitionValidationResult = {
  allowed: boolean;
  reason?: string;
  code?: BookingLifecycleErrorCode;
  allowedTargets?: BookingStatus[];
};

export class BookingStateMachine {
  private readonly transitions = ALLOWED_TRANSITIONS;

  get allowedStatuses(): Readonly<Record<BookingStatus, ReadonlySet<BookingStatus>>> {
    return this.transitions;
  }

  getAllowedTargets(status: BookingStatus): BookingStatus[] {
    return Array.from(this.transitions[status] ?? []);
  }

  validateTransition({ from, to, allowSameState = true }: TransitionCheck): TransitionValidationResult {
    if (from === to) {
      if (allowSameState) {
        return { allowed: true, allowedTargets: this.getAllowedTargets(from) };
      }
      return {
        allowed: false,
        reason: `Transition from ${from} to ${to} requires a state change`,
        code: "ALREADY_IN_STATE",
        allowedTargets: this.getAllowedTargets(from),
      };
    }

    const allowedTargets = this.transitions[from];
    if (!allowedTargets) {
      return {
        allowed: false,
        reason: `Unknown booking status "${from}"`,
        code: "UNKNOWN_STATUS",
        allowedTargets: [],
      };
    }

    if (!allowedTargets.has(to)) {
      return {
        allowed: false,
        reason: `Transition from ${from} to ${to} is not permitted`,
        code: "TRANSITION_NOT_ALLOWED",
        allowedTargets: this.getAllowedTargets(from),
      };
    }

    return { allowed: true, allowedTargets: this.getAllowedTargets(from) };
  }

  canTransition(from: BookingStatus, to: BookingStatus, allowSameState = true): boolean {
    return this.validateTransition({ from, to, allowSameState }).allowed;
  }

  assertTransition({ from, to, allowSameState = true }: TransitionCheck): void {
    const validation = this.validateTransition({ from, to, allowSameState });
    if (!validation.allowed) {
      throw new BookingLifecycleError(validation.reason ?? "Transition is not permitted", validation.code);
    }
  }
}

export const bookingStateMachine = new BookingStateMachine();

export function canTransition(from: BookingStatus, to: BookingStatus, allowSameState = true): boolean {
  return bookingStateMachine.canTransition(from, to, allowSameState);
}

export function assertCanTransition({ from, to, allowSameState = true }: TransitionCheck): void {
  bookingStateMachine.assertTransition({ from, to, allowSameState });
}

export const bookingStateMatrix = bookingStateMachine.allowedStatuses;
