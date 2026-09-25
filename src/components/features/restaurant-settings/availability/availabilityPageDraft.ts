/**
 * The Availability page draft: weekly hours, special dates, meal times, booking rules and
 * booking types in one object, compared against the saved copy to find what changed.
 */
import { buildAvailabilityScheduleDraftState } from '../availabilityScheduleManagerDomain';
import {
  REQUIRED_SERVICE_OCCASIONS,
  defaultOverrideRow,
  extractRequiredOccasionKeys,
} from '../availabilityScheduleManagerUtils';
import { DAYS_OF_WEEK, type OverrideRow, type WeeklyRow } from '../types';

import type { DayServiceConfig, MealConfig } from '../servicePeriodsMapper';
import type { SettingsChangeGroup } from '../shared/SettingsReviewChangesDialog';
import type { OpsOccasion } from '@/services/ops/occasions';
import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  ServicePeriodRow,
  TurnBandsPayload,
  TurnBandsSnapshot,
} from '@/services/ops/restaurants';

export type MealKey = 'lunch' | 'dinner';
export const MEAL_KEYS: readonly MealKey[] = ['lunch', 'dinner'];
export const MEAL_LABEL: Record<MealKey, string> = { lunch: 'Lunch', dinner: 'Dinner' };

/** Monday first, as staff read a week. */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

/** Booking rules as typed into the form (strings), saved through the restaurant details API. */
export type BookingRulesDraft = {
  reservationIntervalMinutes: string;
  reservationLastSeatingBufferMinutes: string;
  reservationDefaultDurationMinutes: string;
  reservationLifecycleGraceMinutes: string;
  bookingPolicy: string;
};

export type AvailabilityPageDraft = {
  weeklyRows: WeeklyRow[];
  /** Every override has a stable `id` (server id, or a client uuid for new ones). */
  overrideRows: OverrideRow[];
  dayConfigs: DayServiceConfig[];
  /** Service periods that are not a weekday's lunch or dinner. Saved unchanged. */
  customRows: ServicePeriodRow[];
  occasions: OpsOccasion[];
  turnBands: TurnBandsPayload;
  rules: BookingRulesDraft;
};

export type AvailabilitySaveGroup = 'types' | 'hours' | 'meals' | 'rules';

export const AVAILABILITY_SAVE_GROUP_NAMES: Record<AvailabilitySaveGroup, string> = {
  types: 'Booking types and table times',
  hours: 'Opening hours and special dates',
  meals: 'Meal times',
  rules: 'Booking rules',
};

export function toBookingRulesDraft(profile: RestaurantProfile): BookingRulesDraft {
  return {
    reservationIntervalMinutes: String(profile.reservationIntervalMinutes ?? ''),
    reservationLastSeatingBufferMinutes: String(profile.reservationLastSeatingBufferMinutes ?? ''),
    reservationDefaultDurationMinutes: String(profile.reservationDefaultDurationMinutes ?? ''),
    reservationLifecycleGraceMinutes: String(profile.reservationLifecycleGraceMinutes ?? ''),
    bookingPolicy: profile.bookingPolicy ?? '',
  };
}

export function buildAvailabilityPageDraft(input: {
  operatingHours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriodRow[];
  occasions: OpsOccasion[];
  turnBands: TurnBandsSnapshot;
  profile: RestaurantProfile;
}): AvailabilityPageDraft {
  const state = buildAvailabilityScheduleDraftState({
    occasions: input.occasions,
    operatingHours: input.operatingHours,
    servicePeriods: input.servicePeriods,
    turnBands: input.turnBands,
  });
  return {
    weeklyRows: state.weeklyRows,
    overrideRows: state.overrideRows.map((row) => (row.id ? row : { ...row, id: newOverrideId() })),
    dayConfigs: state.dayConfigs,
    customRows: state.customRows,
    occasions: state.occasionDrafts,
    turnBands: state.turnBandsDraft,
    rules: toBookingRulesDraft(input.profile),
  };
}

function newOverrideId(): string {
  return defaultOverrideRow().id ?? `override-${Math.random().toString(36).slice(2)}`;
}

export function createOverrideRow(): OverrideRow {
  return { ...defaultOverrideRow(), effectiveDate: '' };
}

const stable = (value: unknown) => JSON.stringify(value);

/**
 * What a day's meal times save as. Closed days save no meal windows (the existing payload
 * builder drops them), so their meals compare as off even while the draft remembers them.
 */
const mealParts = (day: DayServiceConfig) => {
  const part = (meal: MealConfig) =>
    day.isClosed || !meal.enabled
      ? { enabled: false }
      : { enabled: true, startTime: meal.startTime, endTime: meal.endTime };
  return { lunch: part(day.lunch), dinner: part(day.dinner) };
};

/** Booking rules edited in the Booking rules section (everything except the default table time). */
function bookingRulesPart({
  reservationDefaultDurationMinutes: _defaultTableTime,
  ...rules
}: BookingRulesDraft) {
  return rules;
}

/**
 * The default table time is stored with the booking rules but edited, reviewed, undone and saved
 * with Booking types and table times, beside the per-type table times it sits under.
 */
const groupParts: Record<AvailabilitySaveGroup, (draft: AvailabilityPageDraft) => unknown> = {
  types: (draft) => ({
    occasions: draft.occasions,
    turnBands: draft.turnBands,
    defaultTableTime: draft.rules.reservationDefaultDurationMinutes,
  }),
  hours: (draft) => ({ weekly: draft.weeklyRows, overrides: draft.overrideRows }),
  meals: (draft) => draft.dayConfigs.map(mealParts),
  rules: (draft) => bookingRulesPart(draft.rules),
};

export function getDirtyAvailabilityGroups(
  saved: AvailabilityPageDraft,
  draft: AvailabilityPageDraft,
): AvailabilitySaveGroup[] {
  return (Object.keys(groupParts) as AvailabilitySaveGroup[]).filter(
    (group) => stable(groupParts[group](saved)) !== stable(groupParts[group](draft)),
  );
}

export function isWeekdayEdited(
  saved: AvailabilityPageDraft,
  draft: AvailabilityPageDraft,
  dayOfWeek: number,
): boolean {
  const pick = (source: AvailabilityPageDraft) => {
    const day = source.dayConfigs.find((item) => item.dayOfWeek === dayOfWeek);
    return {
      row: source.weeklyRows.find((row) => row.dayOfWeek === dayOfWeek),
      meals: day ? mealParts(day) : null,
    };
  };
  return stable(pick(saved)) !== stable(pick(draft));
}

export function hasRequiredBookingTypes(occasions: readonly OpsOccasion[]): boolean {
  const keys = extractRequiredOccasionKeys([...occasions]);
  return Boolean(keys.lunch && keys.dinner);
}

/** Lunch and Dinner added to the draft; they are created when the page is saved. */
export function withRequiredBookingTypes(occasions: readonly OpsOccasion[]): OpsOccasion[] {
  const keys = extractRequiredOccasionKeys([...occasions]);
  const missing = REQUIRED_SERVICE_OCCASIONS.filter((spec) => !keys[spec.key]);
  const now = new Date().toISOString();
  return [
    ...missing.map<OpsOccasion>((spec) => ({
      key: spec.key,
      label: spec.label,
      shortLabel: spec.shortLabel,
      description: spec.description,
      availability: [{ kind: 'anytime' }],
      defaultDurationMinutes: spec.defaultDurationMinutes,
      displayOrder: spec.displayOrder,
      isActive: true,
      isBuiltin: true,
      createdAt: now,
      updatedAt: now,
    })),
    ...occasions,
  ];
}

// ── Weekday edits ─────────────────────────────────────────────────────────────

export function patchWeekday(
  draft: AvailabilityPageDraft,
  dayOfWeek: number,
  patch: Partial<
    Pick<
      WeeklyRow,
      | 'opensAt'
      | 'closesAt'
      | 'isClosed'
      | 'notes'
      | 'reservationIntervalMinutes'
      | 'reservationSlotTimes'
    >
  >,
): AvailabilityPageDraft {
  return {
    ...draft,
    weeklyRows: draft.weeklyRows.map((row) =>
      row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row,
    ),
    // Meal times are validated against the draft hours, so keep the day's copy in step.
    dayConfigs: draft.dayConfigs.map((day) =>
      day.dayOfWeek === dayOfWeek
        ? {
            ...day,
            opensAt: patch.opensAt !== undefined ? patch.opensAt : day.opensAt,
            closesAt: patch.closesAt !== undefined ? patch.closesAt : day.closesAt,
            isClosed: patch.isClosed ?? day.isClosed,
          }
        : day,
    ),
  };
}

export function patchMeal(
  draft: AvailabilityPageDraft,
  dayOfWeek: number,
  meal: MealKey,
  patch: Partial<Pick<MealConfig, 'enabled' | 'startTime' | 'endTime'>>,
): AvailabilityPageDraft {
  return {
    ...draft,
    dayConfigs: draft.dayConfigs.map((day) =>
      day.dayOfWeek === dayOfWeek ? { ...day, [meal]: { ...day[meal], ...patch } } : day,
    ),
  };
}

/** Copies open/closed, hours, lunch and dinner. Notes and slot options stay as they are. */
export function copyWeekday(
  draft: AvailabilityPageDraft,
  fromDay: number,
  toDays: readonly number[],
): AvailabilityPageDraft {
  const sourceRow = draft.weeklyRows.find((row) => row.dayOfWeek === fromDay);
  const sourceDay = draft.dayConfigs.find((day) => day.dayOfWeek === fromDay);
  if (!sourceRow || !sourceDay) {
    return draft;
  }
  const targets = new Set(toDays.filter((day) => day !== fromDay));
  return {
    ...draft,
    weeklyRows: draft.weeklyRows.map((row) =>
      targets.has(row.dayOfWeek)
        ? {
            ...row,
            isClosed: sourceRow.isClosed,
            opensAt: sourceRow.opensAt,
            closesAt: sourceRow.closesAt,
          }
        : row,
    ),
    dayConfigs: draft.dayConfigs.map((day) =>
      targets.has(day.dayOfWeek)
        ? {
            ...day,
            isClosed: sourceDay.isClosed,
            opensAt: sourceDay.opensAt,
            closesAt: sourceDay.closesAt,
            lunch: {
              ...day.lunch,
              enabled: sourceDay.lunch.enabled,
              startTime: sourceDay.lunch.startTime,
              endTime: sourceDay.lunch.endTime,
            },
            dinner: {
              ...day.dinner,
              enabled: sourceDay.dinner.enabled,
              startTime: sourceDay.dinner.startTime,
              endTime: sourceDay.dinner.endTime,
            },
          }
        : day,
    ),
  };
}

export function undoWeekday(
  saved: AvailabilityPageDraft,
  draft: AvailabilityPageDraft,
  dayOfWeek: number,
): AvailabilityPageDraft {
  return {
    ...draft,
    weeklyRows: draft.weeklyRows.map((row) =>
      row.dayOfWeek === dayOfWeek
        ? (saved.weeklyRows.find((item) => item.dayOfWeek === dayOfWeek) ?? row)
        : row,
    ),
    dayConfigs: draft.dayConfigs.map((day) =>
      day.dayOfWeek === dayOfWeek
        ? (saved.dayConfigs.find((item) => item.dayOfWeek === dayOfWeek) ?? day)
        : day,
    ),
  };
}

/** Puts one save group back to its saved state (Review changes → Undo section). */
export function undoAvailabilityGroup(
  saved: AvailabilityPageDraft,
  draft: AvailabilityPageDraft,
  group: AvailabilitySaveGroup,
): AvailabilityPageDraft {
  switch (group) {
    case 'types':
      return {
        ...draft,
        occasions: saved.occasions,
        turnBands: saved.turnBands,
        rules: {
          ...draft.rules,
          reservationDefaultDurationMinutes: saved.rules.reservationDefaultDurationMinutes,
        },
      };
    case 'hours':
      return {
        ...draft,
        weeklyRows: saved.weeklyRows,
        overrideRows: saved.overrideRows,
        dayConfigs: draft.dayConfigs.map((day) => {
          const savedDay = saved.dayConfigs.find((item) => item.dayOfWeek === day.dayOfWeek);
          return savedDay
            ? {
                ...day,
                opensAt: savedDay.opensAt,
                closesAt: savedDay.closesAt,
                isClosed: savedDay.isClosed,
              }
            : day;
        }),
      };
    case 'meals':
      return {
        ...draft,
        dayConfigs: draft.dayConfigs.map((day) => {
          const savedDay = saved.dayConfigs.find((item) => item.dayOfWeek === day.dayOfWeek);
          return savedDay ? { ...day, lunch: savedDay.lunch, dinner: savedDay.dinner } : day;
        }),
      };
    case 'rules':
      return {
        ...draft,
        rules: {
          ...saved.rules,
          reservationDefaultDurationMinutes: draft.rules.reservationDefaultDurationMinutes,
        },
      };
  }
}

// ── Review changes ────────────────────────────────────────────────────────────

const hoursLabel = (row: Pick<WeeklyRow, 'isClosed' | 'opensAt' | 'closesAt'>) =>
  row.isClosed ? 'Closed' : `${row.opensAt || '—'}–${row.closesAt || '—'}`;
const mealLabel = (day: DayServiceConfig, meal: MealKey) => {
  const part = mealParts(day)[meal];
  return part.enabled ? `${part.startTime}–${part.endTime}` : 'Off';
};
const minutesLabel = (value: string) =>
  value.trim() ? `${value.trim()} min` : 'Restaurant setting';

export function formatOverrideDate(date: string, style: 'short' | 'long' = 'short'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date || 'No date';
  }
  const parsed = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(parsed)
    .replace(/,/g, '');
}

const overrideLabel = (row: OverrideRow) =>
  row.isClosed ? 'Closed' : `${row.opensAt || '—'}–${row.closesAt || '—'}`;

export function describeAvailabilityChanges(
  saved: AvailabilityPageDraft,
  draft: AvailabilityPageDraft,
): SettingsChangeGroup[] {
  const hours: SettingsChangeGroup['changes'] = [];
  const meals: SettingsChangeGroup['changes'] = [];
  const rules: SettingsChangeGroup['changes'] = [];
  const types: SettingsChangeGroup['changes'] = [];

  for (const dayOfWeek of WEEK_ORDER) {
    const day = DAYS_OF_WEEK[dayOfWeek];
    const a = saved.weeklyRows.find((row) => row.dayOfWeek === dayOfWeek);
    const b = draft.weeklyRows.find((row) => row.dayOfWeek === dayOfWeek);
    if (a && b) {
      if (hoursLabel(a) !== hoursLabel(b)) {
        hours.push({ label: `${day} opening hours`, was: hoursLabel(a), now: hoursLabel(b) });
      }
      if (a.reservationIntervalMinutes !== b.reservationIntervalMinutes) {
        hours.push({
          label: `${day} time between booking slots`,
          was: minutesLabel(a.reservationIntervalMinutes),
          now: minutesLabel(b.reservationIntervalMinutes),
        });
      }
      if (a.reservationSlotTimes !== b.reservationSlotTimes) {
        hours.push({
          label: `${day} fixed start times`,
          was: a.reservationSlotTimes || 'None',
          now: b.reservationSlotTimes || 'None',
        });
      }
      if (a.notes !== b.notes) {
        hours.push({ label: `${day} note`, was: a.notes || 'None', now: b.notes || 'None' });
      }
    }
    const dayA = saved.dayConfigs.find((item) => item.dayOfWeek === dayOfWeek);
    const dayB = draft.dayConfigs.find((item) => item.dayOfWeek === dayOfWeek);
    if (dayA && dayB) {
      for (const meal of MEAL_KEYS) {
        if (mealLabel(dayA, meal) !== mealLabel(dayB, meal)) {
          meals.push({
            label: `${day} ${MEAL_LABEL[meal].toLowerCase()}`,
            was: mealLabel(dayA, meal),
            now: mealLabel(dayB, meal),
          });
        }
      }
    }
  }

  const savedOverrides = new Map(saved.overrideRows.map((row) => [row.id, row]));
  const draftIds = new Set(draft.overrideRows.map((row) => row.id));
  for (const row of draft.overrideRows) {
    const before = row.id ? savedOverrides.get(row.id) : undefined;
    if (!before) {
      hours.push({
        label: `Special date added: ${formatOverrideDate(row.effectiveDate)}`,
        now: `${overrideLabel(row)}${row.notes ? ` · ${row.notes}` : ''}`,
      });
    } else if (stable(before) !== stable(row)) {
      hours.push({
        label: `Special date ${formatOverrideDate(row.effectiveDate)}`,
        was:
          overrideLabel(before) +
          (before.effectiveDate !== row.effectiveDate
            ? ` on ${formatOverrideDate(before.effectiveDate)}`
            : ''),
        now: overrideLabel(row),
      });
    }
  }
  for (const row of saved.overrideRows) {
    if (!draftIds.has(row.id)) {
      hours.push({
        label: `Special date removed: ${formatOverrideDate(row.effectiveDate)}`,
        was: overrideLabel(row),
        now: 'Removed',
      });
    }
  }

  const ruleLabels: Array<[keyof BookingRulesDraft, string, boolean]> = [
    ['reservationIntervalMinutes', 'Time between booking slots', true],
    ['reservationLastSeatingBufferMinutes', 'Last seating before closing', true],
    ['reservationLifecycleGraceMinutes', 'Late grace period', true],
    ['bookingPolicy', 'Booking policy', false],
  ];
  for (const [key, label, isMinutes] of ruleLabels) {
    if (saved.rules[key] !== draft.rules[key]) {
      const format = (value: string) =>
        value.trim() ? `${value.trim()}${isMinutes ? ' min' : ''}` : 'None';
      rules.push({ label, was: format(saved.rules[key]), now: format(draft.rules[key]) });
    }
  }

  if (
    saved.rules.reservationDefaultDurationMinutes !== draft.rules.reservationDefaultDurationMinutes
  ) {
    const format = (value: string) => (value.trim() ? `${value.trim()} min` : 'None');
    types.push({
      label: 'Default table time',
      was: format(saved.rules.reservationDefaultDurationMinutes),
      now: format(draft.rules.reservationDefaultDurationMinutes),
    });
  }

  const savedTypes = new Map(saved.occasions.map((occasion) => [occasion.key, occasion]));
  const draftKeys = new Set(draft.occasions.map((occasion) => occasion.key));
  for (const occasion of draft.occasions) {
    const before = savedTypes.get(occasion.key);
    const bandsChanged =
      stable(saved.turnBands[occasion.key] ?? []) !== stable(draft.turnBands[occasion.key] ?? []);
    if (!before) {
      types.push({
        label: `Booking type added: ${occasion.label}`,
        now: occasion.isActive ? 'On' : 'Off',
      });
    } else if (before.isActive !== occasion.isActive) {
      types.push({
        label: occasion.label,
        was: before.isActive ? 'On' : 'Off',
        now: occasion.isActive ? 'On' : 'Off',
      });
    } else if (stable(before) !== stable(occasion) || bandsChanged) {
      types.push({ label: occasion.label, was: 'Previous settings', now: 'Edited' });
    }
  }
  for (const occasion of saved.occasions) {
    if (!draftKeys.has(occasion.key)) {
      types.push({
        label: `Booking type removed: ${occasion.label}`,
        was: occasion.label,
        now: 'Removed',
      });
    }
  }

  return [
    { id: 'hours', title: AVAILABILITY_SAVE_GROUP_NAMES.hours, changes: hours },
    { id: 'meals', title: AVAILABILITY_SAVE_GROUP_NAMES.meals, changes: meals },
    { id: 'rules', title: AVAILABILITY_SAVE_GROUP_NAMES.rules, changes: rules },
    { id: 'types', title: AVAILABILITY_SAVE_GROUP_NAMES.types, changes: types },
  ];
}
