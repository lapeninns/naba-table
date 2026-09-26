/** "Needs attention" checks, run on the draft (unsaved changes included). */
import { parseSlotTimesInput, toComparableTime } from '../availabilityScheduleTime';
import { DAYS_OF_WEEK } from '../types';
import {
  MEAL_KEYS,
  MEAL_LABEL,
  WEEK_ORDER,
  hasRequiredBookingTypes,
  type AvailabilityPageDraft,
  type MealKey,
} from './availabilityPageDraft';
import { pluralise } from '../shared/settingsSaveSequence';

import type { AvailabilityErrors } from './availabilityPageValidation';

export type AvailabilityAttentionAction =
  | { kind: 'first-issue' }
  | { kind: 'create-required-types' }
  | { kind: 'open-day'; dayOfWeek: number }
  | { kind: 'edit-type'; key: string }
  | { kind: 'google' }
  /** Nothing the viewer can do on this page (e.g. only Nabatable can add booking types). */
  | { kind: 'none' };

export type AvailabilityAttentionItem = {
  id: string;
  tone: 'issue' | 'warning' | 'info';
  text: string;
  action: AvailabilityAttentionAction;
  actionLabel: string;
};

export type AvailabilityAttentionInput = {
  draft: AvailabilityPageDraft;
  errors: AvailabilityErrors;
  /** Offered times for a party of 2 on the next plain (non-special) date of a weekday. */
  offeredCount: (dayOfWeek: number, meal: MealKey) => number;
  /** Google Business Profile fields for hours and meal times that differ and need a decision. */
  googleDriftCount: number;
  /** Nabatable platform admin: may create booking types. Defaults to false (fail closed). */
  canEditCatalog?: boolean;
};

const inMealWindow = (minutes: string, start: string, end: string) => {
  const time = toComparableTime(minutes);
  const from = toComparableTime(start);
  const to = toComparableTime(end);
  return Boolean(time && from && to && time >= from && time < to);
};

export function buildAvailabilityAttention({
  draft,
  errors,
  offeredCount,
  googleDriftCount,
  canEditCatalog = false,
}: AvailabilityAttentionInput): AvailabilityAttentionItem[] {
  const items: AvailabilityAttentionItem[] = [];
  const issueCount = Object.keys(errors).length;
  if (issueCount > 0) {
    items.push({
      id: 'issues',
      tone: 'issue',
      text: `${issueCount === 1 ? '1 setting needs' : `${issueCount} settings need`} fixing before you can save.`,
      action: { kind: 'first-issue' },
      actionLabel: 'Show first issue',
    });
  }

  const hasRequired = hasRequiredBookingTypes(draft.occasions);
  if (!hasRequired) {
    items.push(
      canEditCatalog
        ? {
            id: 'required-types',
            tone: 'issue',
            text: 'Lunch and Dinner booking types are missing. Guests can’t request meal times until they exist.',
            action: { kind: 'create-required-types' },
            actionLabel: 'Create Lunch and Dinner',
          }
        : {
            id: 'required-types',
            tone: 'issue',
            text: 'Lunch and Dinner booking types are missing, and guests can’t request meal times until they exist. Booking types are managed by Nabatable: contact Nabatable to add them.',
            action: { kind: 'none' },
            actionLabel: '',
          },
    );
  }

  for (const dayOfWeek of WEEK_ORDER) {
    const row = draft.weeklyRows.find((item) => item.dayOfWeek === dayOfWeek);
    const day = draft.dayConfigs.find((item) => item.dayOfWeek === dayOfWeek);
    if (!row || !day || row.isClosed) {
      continue;
    }
    const dayName = DAYS_OF_WEEK[dayOfWeek];
    const fixed = parseSlotTimesInput(row.reservationSlotTimes).value ?? [];
    const outside = fixed.filter(
      (time) =>
        !MEAL_KEYS.some(
          (meal) => day[meal].enabled && inMealWindow(time, day[meal].startTime, day[meal].endTime),
        ),
    );
    if (outside.length > 0) {
      items.push({
        id: `fixed-${dayOfWeek}`,
        tone: 'warning',
        text: `${dayName}: ${pluralise(outside.length, 'fixed start time')} (${outside.join(', ')}) ${
          outside.length === 1 ? 'is' : 'are'
        } outside lunch and dinner, so guests won’t see ${outside.length === 1 ? 'it' : 'them'}.`,
        action: { kind: 'open-day', dayOfWeek },
        actionLabel: `Edit ${dayName}`,
      });
    }

    if (!hasRequired) {
      continue;
    }
    for (const meal of MEAL_KEYS) {
      const hasMealError = Object.keys(errors).some((key) =>
        key.startsWith(`w${dayOfWeek}-${meal}-`),
      );
      if (!day[meal].enabled || hasMealError) {
        continue;
      }
      if (offeredCount(dayOfWeek, meal) === 0) {
        items.push({
          id: `empty-${dayOfWeek}-${meal}`,
          tone: 'warning',
          text: `${dayName} ${MEAL_LABEL[meal].toLowerCase()} is on, but no times can be offered to a party of 2.`,
          action: { kind: 'open-day', dayOfWeek },
          actionLabel: `Edit ${dayName}`,
        });
      }
    }
  }

  for (const meal of MEAL_KEYS) {
    const occasion = draft.occasions.find((item) => item.key.toLowerCase() === meal);
    if (!occasion || occasion.isActive) {
      continue;
    }
    const days = draft.dayConfigs.filter((day) => !day.isClosed && day[meal].enabled).length;
    if (days > 0) {
      items.push({
        id: `type-off-${meal}`,
        tone: 'warning',
        text: `The ${occasion.label} booking type is off while ${MEAL_LABEL[meal].toLowerCase()} meal times are set on ${pluralise(days, 'day')}. Check this is what you want.`,
        action: { kind: 'edit-type', key: occasion.key },
        actionLabel: `Edit ${occasion.label}`,
      });
    }
  }

  if (googleDriftCount > 0) {
    items.push({
      id: 'google',
      tone: 'info',
      text: `Google Business Profile differs on ${pluralise(googleDriftCount, 'opening-hours or meal-time field')}.`,
      action: { kind: 'google' },
      actionLabel: 'Compare on Google page',
    });
  }

  return items;
}
