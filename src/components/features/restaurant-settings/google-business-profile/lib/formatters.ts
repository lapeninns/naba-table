const GBP_DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function formatGbpDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function formatGbpDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export function formatGbpTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return value;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return value;
  }

  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const baseHour = hours % 12 || 12;
  const minuteText = String(minutes).padStart(2, '0');
  return `${baseHour}:${minuteText} ${meridiem}`;
}

export function formatGbpDay(day: number | null): string | null {
  if (day === null || day < 0 || day >= GBP_DAY_LABELS.length) {
    return null;
  }

  return GBP_DAY_LABELS[day] ?? null;
}

export function formatOperatingWindow(params: {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}): string {
  if (params.isClosed) {
    return 'Closed';
  }

  const opensAt = formatGbpTime(params.opensAt) ?? params.opensAt ?? null;
  const closesAt = formatGbpTime(params.closesAt) ?? params.closesAt ?? null;

  if (!opensAt || !closesAt) {
    return 'Not set';
  }

  return `${opensAt} – ${closesAt}`;
}

export function formatServiceWindow(params: {
  startTime: string | null;
  endTime: string | null;
}): string | null {
  if (!params.startTime || !params.endTime) {
    return null;
  }
  const start = formatGbpTime(params.startTime) ?? params.startTime;
  const end = formatGbpTime(params.endTime) ?? params.endTime;
  return `${start} – ${end}`;
}

export function formatLastSync(value: string | null): string {
  return formatGbpDateTime(value) ?? 'Never synced';
}
