import { formatDateKey } from '@/lib/utils/datetime';

export function sanitizeDateParam(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ? value : null;
}

export function computeCalendarRange(date: string): { start: string; end: string } {
  const base = new Date(`${date}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return { start: date, end: date };
  }

  const start = new Date(base);
  start.setDate(1);
  const startWeekday = start.getDay();
  start.setDate(start.getDate() - startWeekday);

  const end = new Date(start);
  end.setDate(end.getDate() + 41);

  return {
    start: formatDateKey(start),
    end: formatDateKey(end),
  };
}
