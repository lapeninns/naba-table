import { DateTime } from 'luxon';

export type OpsDateRange = {
  date: string;
  from: string;
  to: string;
  timezone?: string | null;
};

export function buildOpsDateRange(date: string | null | undefined, timezone?: string | null): OpsDateRange | null {
  if (!date) return null;

  const trimmed = date.trim();
  if (trimmed.length === 0) return null;

  const zone = timezone ?? 'UTC';
  const dt = DateTime.fromISO(trimmed, { zone });
  if (!dt.isValid) return null;

  const start = dt.startOf('day').toUTC();
  const end = start.plus({ days: 1 });

  const fromIso = start.toISO();
  const toIso = end.toISO();

  if (!fromIso || !toIso) return null;

  return {
    date: dt.toFormat('yyyy-LL-dd'),
    from: fromIso,
    to: toIso,
    timezone,
  };
}
