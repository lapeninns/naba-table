const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeComparableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function toGoogleTimeOfDay(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const [hoursToken, minutesToken] = value.slice(0, 5).split(':');
  const hours = Number.parseInt(hoursToken ?? '', 10);
  const minutes = Number.parseInt(minutesToken ?? '', 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return undefined;
  }

  return {
    hours,
    minutes,
  };
}

export function googleDayNameToIndex(value: string | null | undefined): number | null {
  const normalized = normalizeComparableText(value)?.toUpperCase() ?? null;
  if (!normalized) {
    return null;
  }

  const index = DAY_NAMES.indexOf(normalized as (typeof DAY_NAMES)[number]);
  return index >= 0 ? index : null;
}

export function normalizeNumericSelection(
  requested: number[] | undefined,
  available: number[],
): number[] {
  const availableSet = new Set(available);
  const source = requested && requested.length > 0 ? requested : available;
  return [...new Set(source.filter((value) => availableSet.has(value)))].sort(
    (left, right) => left - right,
  );
}

export function ensureSelectionNotEmpty(selected: Array<number | string>, label: string): void {
  if (selected.length === 0) {
    throw new Error(`Select at least one ${label} item to sync with Google Business Profile.`);
  }
}

export function buildRegularHoursPeriod(dayOfWeek: number, opensAt: string, closesAt: string) {
  const openTime = toGoogleTimeOfDay(opensAt);
  const closeTime = toGoogleTimeOfDay(closesAt);

  if (!openTime || !closeTime) {
    throw new Error(
      'Selected operating-hours rows must include valid open and close times before pushing to Google Business Profile.',
    );
  }

  return {
    openDay: DAY_NAMES[dayOfWeek] ?? 'MONDAY',
    closeDay: DAY_NAMES[dayOfWeek] ?? 'MONDAY',
    openTime,
    closeTime,
  };
}
