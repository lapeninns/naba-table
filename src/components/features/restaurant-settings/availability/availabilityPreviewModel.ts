import {
  computeGuestSchedulePreview,
  type GuestPreviewExclusion,
  type GuestPreviewResult,
} from '@/lib/restaurants/guest-schedule/preview';

import {
  buildOperatingHoursPayload,
  extractRequiredOccasionKeys,
} from '../availabilityScheduleManagerUtils';
import { buildAvailabilityServicePayload } from '../availabilitySchedulePayloadDomain';
import { type AvailabilityPageDraft, type BookingRulesDraft } from './availabilityPageDraft';

import type {
  ScheduleHoursRow,
  ScheduleServicePeriod,
} from '@/lib/restaurants/guest-schedule/slots';
import type { TurnBandsByOption } from '@/lib/restaurants/guest-schedule/turn-bands';
import type { OpsOccasion } from '@/services/ops/occasions';
import type { OperatingHoursRow, ServicePeriodRow } from '@/services/ops/restaurants';
import type { OccasionDefinition } from '@reserve/shared/occasions';

export type AvailabilityPreviewSource = {
  draft: AvailabilityPageDraft;
  /** Meal windows exactly as saved; used while meal times have no unsaved changes. */
  savedServicePeriods: readonly ServicePeriodRow[];
  mealsDirty: boolean;
  /** Saved booking rules, used where a draft rule is not a valid number yet. */
  savedRules: BookingRulesDraft;
  timezone: string;
};

const toHoursRow = (row: Omit<OperatingHoursRow, 'dayOfWeek'>): ScheduleHoursRow => ({
  opensAt: row.opensAt,
  closesAt: row.closesAt,
  isClosed: row.isClosed,
  notes: row.notes,
  reservationIntervalMinutes: row.reservationIntervalMinutes ?? null,
  reservationSlotTimes: row.reservationSlotTimes ?? null,
});

const toOccasionDefinition = (occasion: OpsOccasion): OccasionDefinition => ({
  key: occasion.key,
  label: occasion.label,
  shortLabel: occasion.shortLabel,
  description: occasion.description ?? null,
  availability: occasion.availability ?? [],
  defaultDurationMinutes: occasion.defaultDurationMinutes,
  displayOrder: occasion.displayOrder ?? 0,
  isActive: occasion.isActive,
});

function parseRule(value: string, fallback: string): number | null {
  for (const candidate of [value, fallback]) {
    const parsed = Number(candidate.trim());
    if (candidate.trim() && Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toTurnBands(draft: AvailabilityPageDraft): TurnBandsByOption {
  const bands: TurnBandsByOption = {};
  for (const [key, rows] of Object.entries(draft.turnBands)) {
    const parsed = (rows ?? [])
      .map((row) => ({
        maxPartySize: Number(row.maxPartySize),
        durationMinutes: Number(row.durationMinutes),
      }))
      .filter((row) => Number.isFinite(row.maxPartySize) && Number.isFinite(row.durationMinutes))
      .sort((a, b) => a.maxPartySize - b.maxPartySize);
    if (parsed.length > 0) {
      bands[key.trim().toLowerCase()] = parsed;
    }
  }
  return bands;
}

function servicePeriodsFor(source: AvailabilityPreviewSource): ScheduleServicePeriod[] {
  const keys = extractRequiredOccasionKeys(source.draft.occasions);
  const rows = source.mealsDirty
    ? buildAvailabilityServicePayload({
        customRows: source.draft.customRows,
        dayConfigs: source.draft.dayConfigs,
        occasionKeys: { lunch: keys.lunch ?? 'lunch', dinner: keys.dinner ?? 'dinner' },
      })
    : source.savedServicePeriods;
  return rows.map((row, index) => ({
    id: row.id ?? `draft-${index}`,
    name: row.name,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    bookingOption: row.bookingOption,
  }));
}

/** The times a guest could request on `date` if these settings were saved. */
export function previewAvailabilityDate(
  source: AvailabilityPreviewSource,
  date: string,
  partySize: number,
  options: { ignoreOverride?: boolean } = {},
): GuestPreviewResult {
  const payload = buildOperatingHoursPayload(source.draft.weeklyRows, source.draft.overrideRows);
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const weekly = payload.weekly.find((row) => row.dayOfWeek === dayOfWeek);
  const override = options.ignoreOverride
    ? undefined
    : payload.overrides.find((row) => row.effectiveDate === date);
  const { rules } = source.draft;

  return computeGuestSchedulePreview({
    date,
    timezone: source.timezone,
    partySize,
    rules: {
      intervalMinutes: parseRule(
        rules.reservationIntervalMinutes,
        source.savedRules.reservationIntervalMinutes,
      ),
      defaultDurationMinutes: parseRule(
        rules.reservationDefaultDurationMinutes,
        source.savedRules.reservationDefaultDurationMinutes,
      ),
      lastSeatingBufferMinutes: parseRule(
        rules.reservationLastSeatingBufferMinutes,
        source.savedRules.reservationLastSeatingBufferMinutes,
      ),
    },
    weeklyRow: weekly ? toHoursRow(weekly) : null,
    overrideRow: override ? toHoursRow(override) : null,
    periods: servicePeriodsFor(source),
    occasions: source.draft.occasions.map(toOccasionDefinition),
    turnBandsByOption: toTurnBands(source.draft),
  });
}

/** The next date (after `from`) that falls on `dayOfWeek`, as YYYY-MM-DD. */
export function nextDateForWeekday(from: string, dayOfWeek: number): string {
  const base = new Date(`${from}T12:00:00Z`);
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(base.getTime() + offset * 86_400_000);
    if (candidate.getUTCDay() === dayOfWeek) {
      return candidate.toISOString().slice(0, 10);
    }
  }
  return from;
}

export type PreviewExclusionGroup = {
  key: string;
  title: string;
  detail: string;
  times: string[];
};

function exclusionCopy(
  exclusion: GuestPreviewExclusion,
  labels: Map<string, string>,
): [string, string] {
  switch (exclusion.kind) {
    case 'outside_meal_times':
      return ['Outside lunch and dinner', 'Guests never see these times.'];
    case 'not_available_on_date': {
      const label = labels.get(exclusion.bookingOption) ?? exclusion.bookingOption;
      return [
        `${label} isn’t available on this date`,
        'Set by the booking type’s availability rules.',
      ];
    }
    case 'after_last_seating':
      return [
        `After last seating (${exclusion.lastSeating})`,
        'Last seating is set under Booking rules.',
      ];
    case 'runs_past_closing':
      return [
        `A ${exclusion.durationMinutes}-minute table would run past closing (${exclusion.closesAt})`,
        'Table time depends on party size.',
      ];
    case 'too_long_for_online':
      return [
        `A ${exclusion.durationMinutes}-minute table is longer than online booking allows (6 hours)`,
        'Table time depends on party size.',
      ];
    case 'ends_next_day':
      return [
        `A ${exclusion.durationMinutes}-minute table would end the next day`,
        'Online bookings start and end on the same day.',
      ];
    case 'overnight_hours':
      return ['Hours run past midnight', 'Online booking doesn’t support hours past midnight.'];
  }
}

const exclusionKey = (exclusion: GuestPreviewExclusion) => JSON.stringify(exclusion);

export function groupPreviewExclusions(
  result: GuestPreviewResult,
  occasions: readonly OpsOccasion[],
): PreviewExclusionGroup[] {
  const labels = new Map(occasions.map((occasion) => [occasion.key, occasion.label]));
  const groups = new Map<string, PreviewExclusionGroup>();
  for (const entry of result.excluded) {
    const key = exclusionKey(entry.exclusion);
    const existing = groups.get(key);
    if (existing) {
      existing.times.push(entry.value);
      continue;
    }
    const [title, detail] = exclusionCopy(entry.exclusion, labels);
    groups.set(key, { key, title, detail, times: [entry.value] });
  }
  return [...groups.values()];
}

/** "17:00–18:30 (4), 21:45" — consecutive times at the day's spacing collapse into ranges. */
export function formatTimeRanges(times: readonly string[], stepMinutes: number): string {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours ?? 0) * 60 + (minutes ?? 0);
  };
  const ranges: Array<{ from: string; to: string; count: number; last: number }> = [];
  for (const time of times) {
    const minutes = toMinutes(time);
    const current = ranges[ranges.length - 1];
    if (current && minutes - current.last <= stepMinutes) {
      current.to = time;
      current.count += 1;
      current.last = minutes;
    } else {
      ranges.push({ from: time, to: time, count: 1, last: minutes });
    }
  }
  return ranges
    .map((range) => (range.count === 1 ? range.from : `${range.from}–${range.to} (${range.count})`))
    .join(', ');
}
