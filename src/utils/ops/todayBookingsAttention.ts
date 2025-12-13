import { DateTime } from 'luxon';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export const OPS_CHECK_IN_ELIGIBLE_STATUSES: OpsTodayBooking['status'][] = [
  'pending',
  'pending_allocation',
  'confirmed',
];

export type OpsBookingTemporalInfo = {
  state: 'past' | 'imminent' | 'upcoming' | 'unknown';
  diffMinutes: number | null;
  start: DateTime | null;
  end: DateTime | null;
};

export type OpsBookingActionRequirements = {
  needsCheckIn: boolean;
  needsCheckOut: boolean;
  needsTableAssignment: boolean;
  needsAttention: boolean;
};

export function getOpsBookingTemporalInfo(
  booking: OpsTodayBooking,
  summary: OpsTodayBookingsSummary,
  now: DateTime,
): OpsBookingTemporalInfo {
  if (!booking.startTime) {
    const end = booking.endTime
      ? DateTime.fromISO(
          /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(booking.endTime ?? '')
            ? booking.endTime!
            : `${summary.date}T${booking.endTime}`,
          { zone: summary.timezone },
        )
      : null;

    return {
      state: 'unknown',
      diffMinutes: null,
      start: null,
      end: end?.isValid ? end : null,
    };
  }

  const startValue = booking.startTime;
  const start = DateTime.fromISO(
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(startValue ?? '') ? startValue! : `${summary.date}T${startValue}`,
    { zone: summary.timezone },
  );

  const endValue = booking.endTime;
  const end = endValue
    ? DateTime.fromISO(
        /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(endValue ?? '') ? endValue! : `${summary.date}T${endValue}`,
        { zone: summary.timezone },
      )
    : null;

  if (!start.isValid) {
    return {
      state: 'unknown',
      diffMinutes: null,
      start: null,
      end: end?.isValid ? end : null,
    };
  }

  const diffMinutes = start.diff(now, 'minutes').minutes ?? 0;

  if (diffMinutes < 0) {
    return {
      state: 'past',
      diffMinutes,
      start,
      end: end?.isValid ? end : null,
    };
  }

  if (diffMinutes <= 15) {
    return {
      state: 'imminent',
      diffMinutes,
      start,
      end: end?.isValid ? end : null,
    };
  }

  return {
    state: 'upcoming',
    diffMinutes,
    start,
    end: end?.isValid ? end : null,
  };
}

export function getOpsBookingActionRequirements(params: {
  booking: OpsTodayBooking;
  temporalInfo: OpsBookingTemporalInfo;
  now: DateTime;
  statusForActions: OpsTodayBooking['status'];
  allowTableAssignments: boolean;
  hasAssignmentHandlers: boolean;
}): OpsBookingActionRequirements {
  const { booking, temporalInfo, now, statusForActions, allowTableAssignments, hasAssignmentHandlers } = params;

  const needsCheckIn =
    temporalInfo.start !== null &&
    temporalInfo.start <= now &&
    OPS_CHECK_IN_ELIGIBLE_STATUSES.includes(statusForActions);

  const needsCheckOut = temporalInfo.end !== null && temporalInfo.end <= now && statusForActions === 'checked_in';

  const allowAssignmentsForBooking =
    allowTableAssignments && hasAssignmentHandlers && temporalInfo.state !== 'past';

  const hasAssignedTable = (booking.tableAssignments?.length ?? 0) > 0;

  const needsTableAssignment =
    Boolean(booking.requiresTableAssignment) && allowAssignmentsForBooking && !hasAssignedTable;

  const needsAttention = needsCheckIn || needsCheckOut || needsTableAssignment;

  return {
    needsCheckIn,
    needsCheckOut,
    needsTableAssignment,
    needsAttention,
  };
}

