import { differenceInMinutes } from "date-fns";

import type { Json, Tables, TablesInsert } from "@/types/supabase";

import {
  assertCanTransition,
  BookingLifecycleError,
  type BookingLifecycleErrorCode,
  type BookingStatus,
} from "./stateMachine";

type BookingRow = Pick<
  Tables<"bookings">,
  "id" | "status" | "checked_in_at" | "checked_out_at" | "booking_date" | "start_time" | "restaurant_id"
>;

type HistoryRow = Tables<"booking_state_history">;

type HistoryInsert = TablesInsert<"booking_state_history">;

type BaseContext = {
  booking: BookingRow;
  actorId: string;
  now?: Date;
  reason?: string | null;
};

type TimestampContext = BaseContext & {
  performedAt?: string | null;
};

type CheckInOptions = TimestampContext;

type CheckOutOptions = TimestampContext & {
  allowStatusDowngrade?: boolean;
};

type NoShowOptions = TimestampContext & {
  allowFromCheckedIn?: boolean;
};

type UndoNoShowOptions = BaseContext & {
  historyEntry?: HistoryRow | null;
  graceMinutes?: number;
};

export type TransitionResult = {
  skipUpdate: boolean;
  updates: Partial<Tables<"bookings">> & { updated_at?: string };
  history?: HistoryInsert;
  response: {
    status: BookingStatus;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    updatedAt?: string;
  };
};

function toDate(value: string | null | undefined, label: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BookingLifecycleError(`Invalid ${label} timestamp`, "TIMESTAMP_INVALID");
  }
  return parsed;
}

function resolveNow(now?: Date): Date {
  const current = now ?? new Date();
  if (Number.isNaN(current.getTime())) {
    throw new BookingLifecycleError("Invalid current time reference", "TIMESTAMP_INVALID");
  }
  return current;
}

function normalizePerformedAt(performedAt: string | null | undefined, now: Date): { iso: string; date: Date } {
  if (!performedAt) {
    return { iso: now.toISOString(), date: now };
  }

  const parsed = new Date(performedAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new BookingLifecycleError("Invalid performedAt timestamp", "TIMESTAMP_INVALID");
  }

  return { iso: parsed.toISOString(), date: parsed };
}

function ensureNotFuture(timestamp: Date, now: Date, code: BookingLifecycleErrorCode = "TIMESTAMP_INVALID") {
  if (timestamp.getTime() > now.getTime()) {
    throw new BookingLifecycleError("Timestamp cannot be in the future", code);
  }
}

function ensureChronology(
  earlier: Date | null,
  later: Date,
  message: string,
  code: BookingLifecycleErrorCode = "TIMESTAMP_INVALID",
) {
  if (earlier && later.getTime() < earlier.getTime()) {
    throw new BookingLifecycleError(message, code);
  }
}

function buildHistoryInsert(input: {
  booking: BookingRow;
  toStatus: BookingStatus;
  actorId: string;
  nowIso: string;
  reason?: string | null;
  metadata: Json;
}): HistoryInsert {
  return {
    booking_id: input.booking.id,
    from_status: input.booking.status,
    to_status: input.toStatus,
    changed_by: input.actorId,
    changed_at: input.nowIso,
    reason: input.reason ?? null,
    metadata: input.metadata,
  };
}

export function prepareCheckInTransition(options: CheckInOptions): TransitionResult {
  const { booking, actorId, reason = null } = options;
  const now = resolveNow(options.now);
  const { iso: performedIso, date: performedAt } = normalizePerformedAt(options.performedAt, now);
  ensureNotFuture(performedAt, now);

  if (booking.checked_out_at) {
    throw new BookingLifecycleError("Cannot check in a booking that is already checked out", "TRANSITION_NOT_ALLOWED");
  }

  const targetStatus: BookingStatus = "checked_in";
  assertCanTransition({ from: booking.status, to: targetStatus, allowSameState: true });

  const updates: TransitionResult["updates"] = {};
  let hasChanges = false;

  const shouldOverwriteTimestamp = options.performedAt !== undefined || !booking.checked_in_at;

  if (booking.status !== targetStatus) {
    updates.status = targetStatus;
    hasChanges = true;
  }

  if (shouldOverwriteTimestamp) {
    updates.checked_in_at = performedIso;
    hasChanges = true;
  }

  if (booking.checked_out_at !== null) {
    updates.checked_out_at = null;
    hasChanges = true;
  }

  if (!hasChanges) {
    return {
      skipUpdate: true,
      updates,
      response: {
        status: booking.status,
        checkedInAt: booking.checked_in_at,
        checkedOutAt: booking.checked_out_at,
      },
    };
  }

  const nowIso = now.toISOString();
  updates.updated_at = nowIso;

  const metadata = {
    action: "check-in",
    performedAt: performedIso,
    previousCheckedInAt: booking.checked_in_at,
    previousCheckedOutAt: booking.checked_out_at,
    featureVariant: "checked_in_status",
  } satisfies Json;

  const history = buildHistoryInsert({
    booking,
    toStatus: targetStatus,
    actorId,
    nowIso,
    reason,
    metadata,
  });

  const resolvedCheckedInAt = "checked_in_at" in updates ? (updates.checked_in_at ?? null) : booking.checked_in_at ?? performedIso;
  const resolvedCheckedOutAt =
    updates.checked_out_at === null ? null : updates.checked_out_at ?? booking.checked_out_at;

  return {
    skipUpdate: false,
    updates,
    history,
    response: {
      status: targetStatus,
      checkedInAt: resolvedCheckedInAt,
      checkedOutAt: resolvedCheckedOutAt,
      updatedAt: nowIso,
    },
  };
}

export function prepareCheckOutTransition(options: CheckOutOptions): TransitionResult {
  const { booking, actorId, reason = null } = options;
  const now = resolveNow(options.now);
  const { iso: performedIso, date: performedAt } = normalizePerformedAt(options.performedAt, now);
  ensureNotFuture(performedAt, now);

  const checkedInDate = toDate(booking.checked_in_at, "checked_in_at");
  if (!checkedInDate) {
    throw new BookingLifecycleError("Booking must be checked in before check-out", "TRANSITION_NOT_ALLOWED");
  }

  ensureChronology(checkedInDate, performedAt, "Check-out time cannot be before check-in", "TIMESTAMP_INVALID");

  const targetStatus: BookingStatus = "completed";
  assertCanTransition({ from: booking.status, to: targetStatus, allowSameState: true });

  const updates: TransitionResult["updates"] = {};
  let hasChanges = false;

  if (booking.status !== targetStatus) {
    updates.status = targetStatus;
    hasChanges = true;
  }

  const shouldOverwrite = options.performedAt !== undefined || !booking.checked_out_at;
  if (shouldOverwrite) {
    updates.checked_out_at = performedIso;
    hasChanges = true;
  }

  if (!hasChanges) {
    return {
      skipUpdate: true,
      updates,
      response: {
        status: booking.status,
        checkedInAt: booking.checked_in_at,
        checkedOutAt: booking.checked_out_at,
      },
    };
  }

  const nowIso = now.toISOString();
  updates.updated_at = nowIso;

  const metadata = {
    action: "check-out",
    performedAt: performedIso,
    previousCheckedOutAt: booking.checked_out_at,
  } satisfies Json;

  const history = buildHistoryInsert({
    booking,
    toStatus: targetStatus,
    actorId,
    nowIso,
    reason,
    metadata,
  });

  const resolvedCheckedOutAt = "checked_out_at" in updates ? updates.checked_out_at ?? null : booking.checked_out_at;

  return {
    skipUpdate: false,
    updates,
    history,
    response: {
      status: targetStatus,
      checkedInAt: booking.checked_in_at,
      checkedOutAt: resolvedCheckedOutAt,
      updatedAt: nowIso,
    },
  };
}

export function prepareNoShowTransition(options: NoShowOptions): TransitionResult {
  const { booking, actorId, reason = null } = options;
  const now = resolveNow(options.now);
  const { iso: performedIso, date: performedAt } = normalizePerformedAt(options.performedAt, now);
  ensureNotFuture(performedAt, now);

  if (!options.allowFromCheckedIn && booking.status === "checked_in") {
    throw new BookingLifecycleError("Cannot mark a checked-in booking as no-show", "TRANSITION_NOT_ALLOWED");
  }

  if (booking.checked_out_at) {
    throw new BookingLifecycleError("Cannot mark a checked-out booking as no-show", "TRANSITION_NOT_ALLOWED");
  }

  const targetStatus: BookingStatus = "no_show";
  assertCanTransition({ from: booking.status, to: targetStatus, allowSameState: false });

  const updates: TransitionResult["updates"] = {
    status: targetStatus,
    checked_in_at: null,
    checked_out_at: null,
    updated_at: now.toISOString(),
  };

  const metadata = {
    action: "no-show",
    performedAt: performedIso,
    previousCheckedInAt: booking.checked_in_at,
    previousCheckedOutAt: booking.checked_out_at,
    previousStatus: booking.status,
  } satisfies Json;

  const history = buildHistoryInsert({
    booking,
    toStatus: targetStatus,
    actorId,
    nowIso: updates.updated_at as string,
    reason,
    metadata,
  });

  return {
    skipUpdate: false,
    updates,
    history,
    response: {
      status: targetStatus,
      checkedInAt: null,
      checkedOutAt: null,
      updatedAt: updates.updated_at,
    },
  };
}

export function prepareUndoNoShowTransition(options: UndoNoShowOptions): TransitionResult {
  const { booking, actorId, historyEntry, graceMinutes = 15, reason = null } = options;
  if (!historyEntry) {
    throw new BookingLifecycleError("No matching history entry found to undo no-show", "MISSING_HISTORY");
  }

  const now = resolveNow(options.now);
  const historyChangedAt = toDate(historyEntry.changed_at, "history.changed_at");
  if (!historyChangedAt) {
    throw new BookingLifecycleError("History entry is malformed", "MISSING_HISTORY");
  }

  const targetStatus = (historyEntry.metadata as Record<string, unknown> | null)?.previousStatus;
  const nextStatus: BookingStatus = typeof targetStatus === "string" ? (targetStatus as BookingStatus) : "confirmed";

  assertCanTransition({ from: booking.status, to: nextStatus, allowSameState: false });

  const minutesSinceNoShow = differenceInMinutes(now, historyChangedAt);
  const withinGrace = Number.isFinite(minutesSinceNoShow) ? minutesSinceNoShow <= graceMinutes : false;

  let restoredCheckedInAt: string | null = null;
  let restoredCheckedOutAt: string | null = null;

  if (withinGrace && historyEntry.metadata && typeof historyEntry.metadata === "object") {
    const metadata = historyEntry.metadata as Record<string, unknown>;
    if (typeof metadata.previousCheckedInAt === "string") {
      restoredCheckedInAt = metadata.previousCheckedInAt;
    }
    if (typeof metadata.previousCheckedOutAt === "string") {
      restoredCheckedOutAt = metadata.previousCheckedOutAt;
    }
  }

  const updates: TransitionResult["updates"] = {
    status: nextStatus,
    checked_in_at: restoredCheckedInAt,
    checked_out_at: restoredCheckedOutAt,
    updated_at: now.toISOString(),
  };

  const metadata = {
    action: "undo-no-show",
    restoredCheckedInAt,
    restoredCheckedOutAt,
    withinGrace,
    sourceHistoryId: historyEntry.id,
  } satisfies Json;

  const history = buildHistoryInsert({
    booking,
    toStatus: nextStatus,
    actorId,
    nowIso: updates.updated_at as string,
    reason,
    metadata,
  });

  return {
    skipUpdate: false,
    updates,
    history,
    response: {
      status: nextStatus,
      checkedInAt: restoredCheckedInAt,
      checkedOutAt: restoredCheckedOutAt,
      updatedAt: updates.updated_at,
    },
  };
}
