/**
 * Configuration preview of the times a guest can request on a date, computed from settings
 * (saved or draft) with the same code as `getGuestBookingSchedule`. It does not check tables or
 * existing bookings, so a time it offers can still be full.
 */
import { DateTime } from 'luxon';

import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';
import { toOccasionCatalog, type OccasionDefinition } from '@reserve/shared/occasions';
import { toMinutes } from '@reserve/shared/time';

import { evaluateOnlineBookingWindow } from './online-booking-window';
import {
  computeScheduleSlotCandidates,
  filterServicePeriodsForDay,
  resolveEffectiveScheduleHours,
  resolveRangeEndMinutes,
  resolveScheduleDayOfWeek,
  resolveScheduleMonth,
  type EffectiveScheduleHours,
  type ScheduleHoursRow,
  type ScheduleServicePeriod,
} from './slots';
import {
  DEFAULT_SERVICE_TURN_BANDS,
  normalizeBookingOptionKey,
  selectTurnBandOrNull,
  type TurnBandsByOption,
} from './turn-bands';

/** Restaurant-level booking rules, as stored (null means "not set"). */
export type GuestPreviewRestaurantRules = {
  intervalMinutes: number | null;
  defaultDurationMinutes: number | null;
  lastSeatingBufferMinutes: number | null;
};

export type GuestPreviewInput = {
  /** YYYY-MM-DD in the restaurant's timezone. */
  date: string;
  timezone: string;
  partySize: number;
  rules: GuestPreviewRestaurantRules;
  weeklyRow: ScheduleHoursRow | null;
  /** The date override for `date`, if any. */
  overrideRow: ScheduleHoursRow | null;
  /** Every meal window; the preview picks the ones for the date's weekday. */
  periods: readonly ScheduleServicePeriod[];
  /** Every booking type, active or not. Only active ones are in the live catalogue. */
  occasions: readonly OccasionDefinition[];
  /** The restaurant's own table-time bands by booking type. */
  turnBandsByOption: TurnBandsByOption;
};

export type GuestPreviewExclusion =
  | { kind: 'outside_meal_times' }
  | { kind: 'not_available_on_date'; bookingOption: string }
  | { kind: 'after_last_seating'; lastSeating: string }
  | { kind: 'runs_past_closing'; durationMinutes: number; closesAt: string }
  | { kind: 'too_long_for_online'; durationMinutes: number }
  | { kind: 'ends_next_day'; durationMinutes: number }
  | { kind: 'overnight_hours' };

export type GuestPreviewSlot = {
  value: string;
  bookingOption: string;
  durationMinutes: number;
};

export type GuestPreviewResult = {
  date: string;
  dayOfWeek: number;
  hours: EffectiveScheduleHours;
  /** Closed all day, or opening equals closing. */
  isClosed: boolean;
  /** Hours past midnight: online booking offers no times. */
  isOvernight: boolean;
  lastSeatingBufferMinutes: number;
  offered: GuestPreviewSlot[];
  excluded: Array<{ value: string; exclusion: GuestPreviewExclusion }>;
};

/**
 * Table time for a party, exactly as `resolveBookingDurationMinutes` resolves it on the server:
 * the restaurant's bands for the booking type, else the built-in bands for lunch or dinner. The
 * booking type's default duration is only a fallback for an invalid band.
 */
export function resolveGuestTableTimeMinutes(input: {
  bookingOption: string;
  partySize: number;
  startTime: string;
  turnBandsByOption: TurnBandsByOption;
  occasions: readonly OccasionDefinition[];
}): number {
  const option = normalizeBookingOptionKey(input.bookingOption);
  const serviceKey: 'lunch' | 'dinner' =
    option === 'lunch' || option === 'dinner'
      ? option
      : toMinutes(input.startTime) >= 17 * 60
        ? 'dinner'
        : 'lunch';
  const ownBands = option ? input.turnBandsByOption[option] : undefined;
  const band =
    ownBands && ownBands.length > 0
      ? selectTurnBandOrNull(ownBands, input.partySize)
      : selectTurnBandOrNull(DEFAULT_SERVICE_TURN_BANDS[serviceKey], input.partySize);
  const duration = band?.durationMinutes ?? Number.NaN;
  if (Number.isFinite(duration) && duration > 0) {
    return Math.round(duration);
  }
  const fallbackOption = option === 'lunch' || option === 'dinner' ? option : 'dinner';
  const definition = input.occasions.find(
    (occasion) => occasion.isActive && occasion.key === fallbackOption,
  );
  return definition?.defaultDurationMinutes ?? (fallbackOption === 'lunch' ? 90 : 120);
}

export function computeGuestSchedulePreview(input: GuestPreviewInput): GuestPreviewResult {
  const intervalMinutes = input.rules.intervalMinutes ?? DEFAULT_RESERVATION_INTERVAL_MINUTES;
  const defaultDurationMinutes = input.rules.defaultDurationMinutes ?? 90;
  const lastSeatingBufferMinutes = input.rules.lastSeatingBufferMinutes ?? defaultDurationMinutes;
  const dayOfWeek = resolveScheduleDayOfWeek(input.date, input.timezone);
  const month = resolveScheduleMonth(input.date, input.timezone);
  const hours = resolveEffectiveScheduleHours({
    overrideRow: input.overrideRow,
    weeklyRow: input.weeklyRow,
    restaurantIntervalMinutes: intervalMinutes,
  });

  const result: GuestPreviewResult = {
    date: input.date,
    dayOfWeek,
    hours,
    isClosed: hours.isClosed,
    isOvernight: false,
    lastSeatingBufferMinutes,
    offered: [],
    excluded: [],
  };
  if (hours.isClosed || !hours.opensAt || !hours.closesAt) {
    return result;
  }

  const openingMinutes = toMinutes(hours.opensAt);
  const closingMinutes = resolveRangeEndMinutes(openingMinutes, toMinutes(hours.closesAt));
  result.isOvernight = closingMinutes !== null && closingMinutes > 24 * 60;

  // The live catalogue holds active booking types only.
  const catalog = toOccasionCatalog(input.occasions.filter((occasion) => occasion.isActive));
  const candidates = computeScheduleSlotCandidates({
    opensAt: hours.opensAt,
    closesAt: hours.closesAt,
    intervalMinutes: hours.intervalMinutes,
    periods: filterServicePeriodsForDay(input.periods, dayOfWeek),
    dayOfWeek,
    catalog,
    date: input.date,
    timezone: input.timezone,
    month,
    fixedSlots: hours.fixedSlotTimes,
  });

  for (const candidate of candidates) {
    const slot = candidate.slot;
    if (!slot) {
      result.excluded.push({ value: candidate.value, exclusion: { kind: 'outside_meal_times' } });
      continue;
    }
    const bookingOption = slot.defaultBookingOption ?? slot.bookingOption;
    const durationMinutes = resolveGuestTableTimeMinutes({
      bookingOption,
      partySize: input.partySize,
      startTime: slot.value,
      turnBandsByOption: input.turnBandsByOption,
      occasions: input.occasions,
    });
    const startDateTime = DateTime.fromISO(`${input.date}T${slot.value}`, {
      zone: input.timezone,
    });
    const evaluation = evaluateOnlineBookingWindow({
      closesAt: hours.closesAt,
      durationMinutes,
      lastSeatingBufferMinutes,
      opensAt: hours.opensAt,
      scheduleDate: input.date,
      startDateTime,
      startTime: slot.value,
    });

    if (slot.disabled) {
      result.excluded.push({
        value: slot.value,
        exclusion: { kind: 'not_available_on_date', bookingOption },
      });
      continue;
    }
    if (evaluation.issues.length > 0) {
      result.excluded.push({
        value: slot.value,
        exclusion: describeWindowIssue(evaluation.issues, durationMinutes, hours.closesAt),
      });
      continue;
    }
    result.offered.push({ value: slot.value, bookingOption: slot.bookingOption, durationMinutes });
  }

  return result;
}

type WindowIssue = ReturnType<typeof evaluateOnlineBookingWindow>['issues'][number];

/** Staff-facing reason for the first blocking issue, read from the evaluator's issue details. */
function describeWindowIssue(
  issues: readonly WindowIssue[],
  durationMinutes: number,
  closesAt: string,
): GuestPreviewExclusion {
  const detailOf = (issue: WindowIssue) => issue.detail ?? {};
  const overnight = issues.find(
    (issue) => detailOf(issue).reason === 'overnight_window_unsupported',
  );
  if (overnight) {
    return { kind: 'overnight_hours' };
  }
  const lastSeating = issues.find((issue) => typeof detailOf(issue).lastSeatingTime === 'string');
  if (lastSeating) {
    return {
      kind: 'after_last_seating',
      lastSeating: String(detailOf(lastSeating).lastSeatingTime),
    };
  }
  if (issues.some((issue) => issue.code === 'OUTSIDE_HOURS' && 'endTime' in detailOf(issue))) {
    return { kind: 'runs_past_closing', durationMinutes, closesAt };
  }
  if (issues.some((issue) => 'maxDurationMinutes' in detailOf(issue))) {
    return { kind: 'too_long_for_online', durationMinutes };
  }
  return { kind: 'ends_next_day', durationMinutes };
}
