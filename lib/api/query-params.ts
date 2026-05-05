export type QueryParamInput =
  | URLSearchParams
  | Record<string, string | string[] | null | undefined>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readValues(source: QueryParamInput, key: string): string[] {
  if (source instanceof URLSearchParams) {
    return source.getAll(key);
  }

  const value = source[key];
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

export function firstString(source: QueryParamInput, key: string): string | undefined {
  const value = readValues(source, key).find((entry) => typeof entry === 'string');
  return value === undefined ? undefined : value;
}

export function stringArray(source: QueryParamInput, key: string): string[] {
  return readValues(source, key)
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function safeBool(source: QueryParamInput, key: string, defaultValue = false): boolean {
  const raw = firstString(source, key);
  if (raw === undefined || raw.trim().length === 0) {
    return defaultValue;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

export function safeDate(source: QueryParamInput, key: string): string | undefined {
  const raw = firstString(source, key)?.trim();
  if (!raw || !ISO_DATE_PATTERN.test(raw)) {
    return undefined;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    return undefined;
  }
  return raw;
}

export function daysBetweenInclusive(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) {
    return Number.NaN;
  }
  return Math.floor((toTime - fromTime) / 86_400_000) + 1;
}

export function addUtcDays(date: Date, days: number): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}
