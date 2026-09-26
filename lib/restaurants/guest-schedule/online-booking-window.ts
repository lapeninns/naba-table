import { DateTime } from 'luxon';

export const MAX_ONLINE_BOOKING_DURATION_MINUTES = 6 * 60;

export type OnlineBookingWindowIssue = {
  readonly code: 'INVALID_DURATION' | 'OUTSIDE_HOURS';
  readonly message: string;
  readonly detail?: Record<string, unknown>;
  readonly overridable: false;
};

export type OnlineBookingWindowEvaluation = {
  readonly endDateTime: DateTime;
  readonly endTime: string;
  readonly issues: readonly OnlineBookingWindowIssue[];
};

export type OnlineBookingWindowInput = {
  readonly closesAt: string | null;
  readonly durationMinutes: number;
  readonly lastSeatingBufferMinutes: number;
  readonly opensAt: string | null;
  readonly scheduleDate: string;
  readonly startDateTime: DateTime;
  readonly startTime: string;
};

export function evaluateOnlineBookingWindow(
  input: OnlineBookingWindowInput,
): OnlineBookingWindowEvaluation {
  const issues: OnlineBookingWindowIssue[] = [];
  const endDateTime = input.startDateTime.plus({ minutes: input.durationMinutes });
  const endTime = endDateTime.toFormat('HH:mm');

  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
    issues.push({
      code: 'INVALID_DURATION',
      message: 'Duration must be greater than zero.',
      detail: { durationMinutes: input.durationMinutes },
      overridable: false,
    });
  }

  if (input.durationMinutes > MAX_ONLINE_BOOKING_DURATION_MINUTES) {
    issues.push({
      code: 'INVALID_DURATION',
      message: 'Duration is longer than the online booking limit.',
      detail: {
        durationMinutes: input.durationMinutes,
        maxDurationMinutes: MAX_ONLINE_BOOKING_DURATION_MINUTES,
      },
      overridable: false,
    });
  }

  if (!endDateTime.isValid || endDateTime <= input.startDateTime) {
    issues.push({
      code: 'INVALID_DURATION',
      message: 'Booking end time must be after the start time.',
      detail: { durationMinutes: input.durationMinutes },
      overridable: false,
    });
  } else if (endDateTime.toISODate() !== input.scheduleDate) {
    issues.push({
      code: 'INVALID_DURATION',
      message: 'Online bookings must start and end on the same day.',
      detail: { durationMinutes: input.durationMinutes },
      overridable: false,
    });
  }

  if (!input.closesAt) {
    return { endDateTime, endTime, issues };
  }

  const zone = input.startDateTime.zoneName ?? 'UTC';
  const closesAtDateTime = DateTime.fromISO(`${input.scheduleDate}T${input.closesAt}`, { zone });
  const opensAtDateTime = input.opensAt
    ? DateTime.fromISO(`${input.scheduleDate}T${input.opensAt}`, { zone })
    : null;
  const isOvernightWindow =
    opensAtDateTime?.isValid === true &&
    closesAtDateTime.isValid &&
    closesAtDateTime <= opensAtDateTime;

  if (isOvernightWindow) {
    issues.push({
      code: 'OUTSIDE_HOURS',
      message: 'Online booking is unavailable for overnight operating hours.',
      detail: {
        openingTime: input.opensAt,
        closingTime: input.closesAt,
        reason: 'overnight_window_unsupported',
      },
      overridable: false,
    });
    return { endDateTime, endTime, issues };
  }

  if (!closesAtDateTime.isValid) {
    return { endDateTime, endTime, issues };
  }

  if (endDateTime > closesAtDateTime) {
    issues.push({
      code: 'OUTSIDE_HOURS',
      message: 'Selected duration extends beyond closing hours.',
      detail: {
        closingTime: input.closesAt,
        endTime,
      },
      overridable: false,
    });
  }

  const bufferMinutes = Math.max(0, Math.round(input.lastSeatingBufferMinutes));
  const lastSeatingCutoff = closesAtDateTime.minus({ minutes: bufferMinutes });
  if (input.startDateTime > lastSeatingCutoff) {
    issues.push({
      code: 'OUTSIDE_HOURS',
      message: 'Selected time is after the final seating cutoff.',
      detail: {
        closingTime: input.closesAt,
        lastSeatingBufferMinutes: bufferMinutes,
        lastSeatingTime: lastSeatingCutoff.toFormat('HH:mm'),
        startTime: input.startTime,
      },
      overridable: false,
    });
  }

  return { endDateTime, endTime, issues };
}
