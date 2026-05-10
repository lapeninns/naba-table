function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export type FutureBookingDate = {
  isoDate: string;
  displayLabel: string;
  startIsoUtc: string;
  endIsoUtc: string;
};

export function buildFutureBookingDate(daysAhead = 2): FutureBookingDate {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(0, 0, 0, 0);

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const isoDate = `${year}-${pad(month + 1)}-${pad(day)}`;
  const stableCalendarDate = new Date(Date.UTC(year, month, day, 12, 0, 0));

  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(stableCalendarDate);
  const monthName = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    timeZone: 'UTC',
  }).format(stableCalendarDate);
  const displayLabel = `${weekday}, ${monthName} ${ordinal(day)}, ${year}`;

  const startIsoUtc = new Date(Date.UTC(year, month, day, 19, 0, 0)).toISOString();
  const endIsoUtc = new Date(Date.UTC(year, month, day, 20, 30, 0)).toISOString();

  return {
    isoDate,
    displayLabel,
    startIsoUtc,
    endIsoUtc,
  };
}
