export type ServicePeriodLike = {
  id?: string;
  name?: string | null;
  dayOfWeek?: number | null;
  day_of_week?: number | null;
  startTime?: string | null;
  start_time?: string | null;
  endTime?: string | null;
  end_time?: string | null;
  bookingOption?: string | null;
  booking_option?: string | null;
};

function readDayOfWeek(period: ServicePeriodLike): number | null {
  if (typeof period.dayOfWeek === 'number') {
    return period.dayOfWeek;
  }
  if (typeof period.day_of_week === 'number') {
    return period.day_of_week;
  }
  return null;
}

function readStartTime(period: ServicePeriodLike): string | null {
  return period.startTime ?? period.start_time ?? null;
}

function readEndTime(period: ServicePeriodLike): string | null {
  return period.endTime ?? period.end_time ?? null;
}

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function isTimeWithinPeriod(
  requestedTime: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): boolean {
  const targetMinutes = timeToMinutes(requestedTime);
  const startMinutes = timeToMinutes(startTime ?? undefined);
  const endMinutes = timeToMinutes(endTime ?? undefined);

  if (targetMinutes === null || startMinutes === null || endMinutes === null) {
    return true;
  }

  if (endMinutes > startMinutes) {
    return targetMinutes >= startMinutes && targetMinutes < endMinutes;
  }

  if (endMinutes < startMinutes) {
    return targetMinutes >= startMinutes || targetMinutes < endMinutes;
  }

  return true;
}

export function selectMatchingPeriod<T extends ServicePeriodLike>(
  periods: T[],
  requestedTime: string,
  dayOfWeek: number,
): T | null {
  const candidates = periods
    .filter((period) => {
      const periodDay = readDayOfWeek(period);
      return periodDay === null || periodDay === dayOfWeek;
    })
    .filter((period) => isTimeWithinPeriod(requestedTime, readStartTime(period), readEndTime(period)));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const startA = timeToMinutes(readStartTime(a));
    const startB = timeToMinutes(readStartTime(b));
    if (startA !== null && startB !== null && startA !== startB) {
      return startA - startB;
    }
    const nameA = a.name ?? '';
    const nameB = b.name ?? '';
    return nameA.localeCompare(nameB);
  });

  return candidates[0] ?? null;
}
