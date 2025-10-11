const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

function toTrimmedString(value: string): string {
  return typeof value === 'string' ? value.trim() : `${value}`.trim();
}

export function canonicalTime(value: string, context = 'time'): string {
  const trimmed = toTrimmedString(value);
  const match = TIME_REGEX.exec(trimmed);
  if (!match) {
    throw new Error(`${context}: expected HH:MM or HH:MM:SS format`);
  }
  return `${match[1]}:${match[2]}`;
}

export function canonicalOptionalTime(
  value: string | null | undefined,
  context = 'time',
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = toTrimmedString(value);
  if (!trimmed) {
    return null;
  }
  return canonicalTime(trimmed, context);
}

export function canonicalizeFromDb(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = toTrimmedString(value);
  const match = TIME_REGEX.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  return `${match[1]}:${match[2]}`;
}

export { TIME_REGEX };
