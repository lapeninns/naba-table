import { toComparableTime } from '../availabilityScheduleTime';
import {
  getDirtyAvailabilityGroups,
  type AvailabilityPageDraft,
  type AvailabilitySaveGroup,
} from './availabilityPageDraft';

/** True when any weekday opens later, closes earlier or closes altogether in the draft. */
export function hasNarrowedWeeklyHours(
  saved: AvailabilityPageDraft,
  draft: AvailabilityPageDraft,
): boolean {
  return draft.weeklyRows.some((row) => {
    const before = saved.weeklyRows.find((item) => item.dayOfWeek === row.dayOfWeek);
    if (!before || before.isClosed) {
      return false;
    }
    if (row.isClosed) {
      return true;
    }
    const openBefore = toComparableTime(before.opensAt);
    const openAfter = toComparableTime(row.opensAt);
    const closeBefore = toComparableTime(before.closesAt);
    const closeAfter = toComparableTime(row.closesAt);
    return Boolean(
      (openBefore && openAfter && openAfter > openBefore) ||
      (closeBefore && closeAfter && closeAfter < closeBefore),
    );
  });
}

/**
 * The order the page writes its dirty groups in, so that saved settings stay valid after every
 * step, even if a later step fails:
 * - booking types first, so Lunch and Dinner exist before meal times refer to them;
 * - when a day's hours narrow, meal times before hours, so saved meal times never sit outside
 *   saved hours; otherwise hours first;
 * - booking rules last (they do not depend on the others).
 */
export function planAvailabilitySave(
  saved: AvailabilityPageDraft,
  draft: AvailabilityPageDraft,
): AvailabilitySaveGroup[] {
  const dirty = new Set(getDirtyAvailabilityGroups(saved, draft));
  const order: AvailabilitySaveGroup[] = [];
  if (dirty.has('types')) {
    order.push('types');
  }
  const scheduleOrder: AvailabilitySaveGroup[] = hasNarrowedWeeklyHours(saved, draft)
    ? ['meals', 'hours']
    : ['hours', 'meals'];
  for (const group of scheduleOrder) {
    if (dirty.has(group)) {
      order.push(group);
    }
  }
  if (dirty.has('rules')) {
    order.push('rules');
  }
  return order;
}
