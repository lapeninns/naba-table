export enum BookingAssignmentState {
  CREATED = "created",
  CAPACITY_VERIFIED = "capacity_verified",
  ASSIGNMENT_PENDING = "assignment_pending",
  ASSIGNMENT_IN_PROGRESS = "assignment_in_progress",
  ASSIGNED = "assigned",
  CONFIRMED = "confirmed",
  FAILED = "failed",
  MANUAL_REVIEW = "manual_review",
}

const TRANSITIONS: Record<BookingAssignmentState, Set<BookingAssignmentState>> = {
  [BookingAssignmentState.CREATED]: new Set([
    BookingAssignmentState.CAPACITY_VERIFIED,
    BookingAssignmentState.FAILED,
  ]),
  [BookingAssignmentState.CAPACITY_VERIFIED]: new Set([
    BookingAssignmentState.ASSIGNMENT_PENDING,
    BookingAssignmentState.FAILED,
  ]),
  [BookingAssignmentState.ASSIGNMENT_PENDING]: new Set([
    BookingAssignmentState.ASSIGNMENT_IN_PROGRESS,
    BookingAssignmentState.MANUAL_REVIEW,
    BookingAssignmentState.FAILED,
  ]),
  [BookingAssignmentState.ASSIGNMENT_IN_PROGRESS]: new Set([
    BookingAssignmentState.ASSIGNED,
    BookingAssignmentState.ASSIGNMENT_PENDING,
    BookingAssignmentState.FAILED,
    BookingAssignmentState.MANUAL_REVIEW,
  ]),
  [BookingAssignmentState.ASSIGNED]: new Set([
    BookingAssignmentState.CONFIRMED,
    BookingAssignmentState.ASSIGNMENT_PENDING,
    BookingAssignmentState.MANUAL_REVIEW,
  ]),
  [BookingAssignmentState.CONFIRMED]: new Set([]),
  [BookingAssignmentState.FAILED]: new Set([]),
  [BookingAssignmentState.MANUAL_REVIEW]: new Set([]),
};

export const TERMINAL_ASSIGNMENT_STATES = new Set<BookingAssignmentState>([
  BookingAssignmentState.CONFIRMED,
  BookingAssignmentState.FAILED,
  BookingAssignmentState.MANUAL_REVIEW,
]);

export function canTransition(
  from: BookingAssignmentState,
  to: BookingAssignmentState,
): boolean {
  if (from === to) {
    return false;
  }
  const allowed = TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.has(to);
}
