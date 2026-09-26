/**
 * Onboarding schedule and layout rules, shared by the API boundary (zod superRefine in the
 * onboarding routes) and the wizard forms, so a user-fixable mistake comes back as a
 * 400 with field paths (or never leaves the form) instead of a 500 from the writer.
 *
 * They mirror the checks the writers enforce:
 * - server/restaurants/servicePeriods.ts `validateServicePeriod` / `assertNoOverlappingPeriods`
 *   (HH:MM[:SS], start < end, no overlap within the same dayOfWeek group, where `null`
 *   "all days" is its own group; overlap-exempt booking options may overlap);
 * - server/restaurants/operatingHours.ts `validateWeeklyEntry` / `updateOperatingHours`
 *   (open days need both times and they must differ; overnight hours are allowed;
 *   one entry per day);
 * - the onboarding layout route (table numbers are trimmed and unique, case-sensitively).
 *
 * Paths are relative to the array being checked; callers prefix the array field name.
 */

export type RuleIssue = { path: Array<string | number>; message: string };

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
const TIME_HINT_SERVICE = 'Enter a time like 17:00.';
const TIME_HINT_HOURS = 'Enter a time like 09:00.';

/** HH:MM for a valid time, otherwise null. */
function toMinutesKey(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const match = TIME_REGEX.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

export type ServicePeriodRuleInput = {
  name: string;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  bookingOption: string;
};

export function findServicePeriodIssues(
  periods: ReadonlyArray<ServicePeriodRuleInput>,
  overlapExemptOptions: ReadonlySet<string> = new Set(),
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const valid: Array<{
    index: number;
    name: string;
    day: number | null;
    start: string;
    end: string;
    exempt: boolean;
  }> = [];

  periods.forEach((period, index) => {
    const start = toMinutesKey(period.startTime);
    const end = toMinutesKey(period.endTime);
    if (!start) issues.push({ path: [index, 'startTime'], message: TIME_HINT_SERVICE });
    if (!end) issues.push({ path: [index, 'endTime'], message: TIME_HINT_SERVICE });
    if (!start || !end) return;
    if (start >= end) {
      issues.push({ path: [index, 'endTime'], message: 'End time must be after the start time.' });
      return;
    }
    valid.push({
      index,
      name: period.name.trim(),
      day: period.dayOfWeek ?? null,
      start,
      end,
      exempt: overlapExemptOptions.has(period.bookingOption.trim().toLowerCase()),
    });
  });

  const byDay = new Map<number | null, typeof valid>();
  for (const period of valid) {
    const list = byDay.get(period.day) ?? [];
    list.push(period);
    byDay.set(period.day, list);
  }

  const overlapIssues: RuleIssue[] = [];
  byDay.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start) || a.index - b.index);
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      if (previous.end > current.start && !previous.exempt && !current.exempt) {
        overlapIssues.push({
          path: [current.index, 'startTime'],
          message: `Overlaps "${previous.name}" on the same day. Adjust the times.`,
        });
      }
    }
  });
  overlapIssues.sort((a, b) => Number(a.path[0]) - Number(b.path[0]));

  return [...issues, ...overlapIssues];
}

export type OperatingHourRuleInput = {
  dayOfWeek: number;
  opensAt?: string | null;
  closesAt?: string | null;
  isClosed?: boolean;
};

export function findOperatingHourIssues(hours: ReadonlyArray<OperatingHourRuleInput>): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const seenDays = new Set<number>();

  hours.forEach((hour, index) => {
    if (seenDays.has(hour.dayOfWeek)) {
      issues.push({ path: [index, 'dayOfWeek'], message: 'Each day can only appear once.' });
      return;
    }
    seenDays.add(hour.dayOfWeek);
    if (hour.isClosed) return;

    const opensAt = toMinutesKey(hour.opensAt);
    const closesAt = toMinutesKey(hour.closesAt);
    if (!opensAt) issues.push({ path: [index, 'opensAt'], message: TIME_HINT_HOURS });
    if (!closesAt) issues.push({ path: [index, 'closesAt'], message: TIME_HINT_HOURS });
    if (opensAt && closesAt && opensAt === closesAt) {
      issues.push({
        path: [index, 'closesAt'],
        message: 'Closing time must differ from the opening time.',
      });
    }
  });

  return issues;
}

export function findDuplicateTableNumberIssues(
  tables: ReadonlyArray<{ tableNumber: string }>,
): RuleIssue[] {
  const seen = new Set<string>();
  const issues: RuleIssue[] = [];
  tables.forEach((table, index) => {
    const number = table.tableNumber.trim();
    if (!number) return;
    if (seen.has(number)) {
      issues.push({
        path: [index, 'tableNumber'],
        message: `Table ${number} is already in the list.`,
      });
      return;
    }
    seen.add(number);
  });
  return issues;
}

/** `T<n>` one past the highest numeric suffix in use, so remove-then-add never repeats one. */
export function nextTableNumber(tables: ReadonlyArray<{ tableNumber: string }>): string {
  const used = new Set(tables.map((table) => table.tableNumber.trim()));
  let highest = 0;
  for (const number of used) {
    const match = /(\d+)$/.exec(number);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  let next = highest + 1;
  while (used.has(`T${next}`)) next += 1;
  return `T${next}`;
}
