import { normalizeText } from './businessInfoNormalizationCore';

const DAY_NUMBERS: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export function normalizeMoreHoursTypes(
  value:
    | Array<{
        hoursTypeId?: string;
        displayName?: string;
        localizedDisplayName?: string;
      }>
    | null
    | undefined,
) {
  return (value ?? [])
    .map((item) => {
      const hoursTypeId = normalizeText(item.hoursTypeId);
      const displayName = normalizeText(item.displayName);
      const localizedDisplayName = normalizeText(item.localizedDisplayName);

      if (!hoursTypeId && !displayName && !localizedDisplayName) {
        return null;
      }

      return {
        hoursTypeId,
        displayName,
        localizedDisplayName,
      };
    })
    .filter(
      (
        item,
      ): item is {
        hoursTypeId: string | null;
        displayName: string | null;
        localizedDisplayName: string | null;
      } => Boolean(item),
    );
}

export function googleDayToNumber(day: string | null | undefined): number | null {
  const normalized = normalizeText(day)?.toUpperCase() ?? null;
  if (!normalized) {
    return null;
  }
  return normalized in DAY_NUMBERS ? DAY_NUMBERS[normalized]! : null;
}

export function normalizeGoogleTime(
  value:
    | string
    | {
        hours?: number;
        minutes?: number;
      }
    | null
    | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
      return null;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  if (!Number.isInteger(value.hours)) {
    return null;
  }

  const hours = value.hours ?? 0;
  const minutes = Number.isInteger(value.minutes) ? (value.minutes ?? 0) : 0;
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function normalizeGoogleDate(
  value:
    | {
        year?: number;
        month?: number;
        day?: number;
      }
    | null
    | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (
    !Number.isInteger(value.year) ||
    !Number.isInteger(value.month) ||
    !Number.isInteger(value.day)
  ) {
    return null;
  }

  const year = value.year ?? 0;
  const month = value.month ?? 0;
  const day = value.day ?? 0;
  if (year <= 0 || month <= 0 || day <= 0) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
