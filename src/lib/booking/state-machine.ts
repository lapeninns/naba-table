import { BOOKING_STATE_TRANSITIONS } from '@/config/booking-state-machine';
import type { OpsBookingStatus } from '@/types/ops';

export type BookingTransitionMap = typeof BOOKING_STATE_TRANSITIONS;

export type BookingLifecycleErrorCode =
  | 'TRANSITION_NOT_ALLOWED'
  | 'ALREADY_IN_STATE'
  | 'UNKNOWN_STATUS'
  | 'TIMESTAMP_INVALID'
  | 'GRACE_PERIOD_EXPIRED'
  | 'MISSING_HISTORY';

export type TransitionValidationOptions = {
  allowSameState?: boolean;
};

export type TransitionValidationResult = {
  allowed: boolean;
  reason?: string;
  code?: BookingLifecycleErrorCode;
  allowedTargets: OpsBookingStatus[];
};

const transitionSets: Readonly<Record<OpsBookingStatus, ReadonlySet<OpsBookingStatus>>> = Object.freeze(
  Object.entries(BOOKING_STATE_TRANSITIONS).reduce<Record<OpsBookingStatus, ReadonlySet<OpsBookingStatus>>>(
    (acc, [status, targets]) => {
      acc[status as OpsBookingStatus] = new Set<OpsBookingStatus>(targets as Iterable<OpsBookingStatus>);
      return acc;
    },
    {} as Record<OpsBookingStatus, ReadonlySet<OpsBookingStatus>>,
  ),
);

const terminalStatuses = new Set<OpsBookingStatus>(
  Object.entries(BOOKING_STATE_TRANSITIONS)
    .filter(([status, targets]) => targets.length === 1 && targets[0] === status)
    .map(([status]) => status as OpsBookingStatus),
);

/**
 * Returns the allowed targets for a given booking status. Optionally filter out self transitions.
 */
export function getAllowedTargets(
  status: OpsBookingStatus,
  { includeSelf = true }: { includeSelf?: boolean } = {},
): OpsBookingStatus[] {
  const targets = BOOKING_STATE_TRANSITIONS[status];
  if (!targets) return [];
  if (includeSelf) {
    return [...targets];
  }
  return targets.filter((target) => target !== status);
}

/**
 * Returns whether the provided status is considered terminal (only self transitions allowed).
 */
export function isTerminalStatus(status: OpsBookingStatus): boolean {
  return terminalStatuses.has(status);
}

/**
 * Returns a readonly Set of allowed targets for quick lookups.
 */
export function getTransitionSet(status: OpsBookingStatus): ReadonlySet<OpsBookingStatus> {
  return transitionSets[status] ?? new Set<OpsBookingStatus>();
}

/**
 * Validates whether a transition from one status to another is allowed based on the shared matrix.
 */
export function validateTransition(
  from: OpsBookingStatus,
  to: OpsBookingStatus,
  options: TransitionValidationOptions = {},
): TransitionValidationResult {
  const { allowSameState = true } = options;

  if (from === to) {
    if (allowSameState) {
      return { allowed: true, allowedTargets: getAllowedTargets(from) };
    }
    return {
      allowed: false,
      reason: `Transition from ${from} to ${to} requires a state change`,
      code: 'ALREADY_IN_STATE',
      allowedTargets: getAllowedTargets(from),
    };
  }

  const targets = getTransitionSet(from);
  if (targets.size === 0) {
    return {
      allowed: false,
      reason: `Unknown booking status "${from}"`,
      code: 'UNKNOWN_STATUS',
      allowedTargets: [],
    };
  }

  if (!targets.has(to)) {
    return {
      allowed: false,
      reason: `Transition from ${from} to ${to} is not permitted`,
      code: 'TRANSITION_NOT_ALLOWED',
      allowedTargets: getAllowedTargets(from),
    };
  }

  return { allowed: true, allowedTargets: getAllowedTargets(from) };
}

/**
 * Convenience helper to check if a transition is allowed.
 */
export function canTransitionTo(
  from: OpsBookingStatus,
  to: OpsBookingStatus,
  options: TransitionValidationOptions = {},
): boolean {
  return validateTransition(from, to, options).allowed;
}

/**
 * Returns potential next statuses excluding the current status by default.
 */
export function getAvailableActions(
  status: OpsBookingStatus,
  { includeSelf = false }: { includeSelf?: boolean } = {},
): OpsBookingStatus[] {
  return getAllowedTargets(status, { includeSelf });
}

/**
 * Returns the canonical transition map precomputed as Sets.
 */
export function getTransitionMatrix(): Readonly<Record<OpsBookingStatus, ReadonlySet<OpsBookingStatus>>> {
  return transitionSets;
}
