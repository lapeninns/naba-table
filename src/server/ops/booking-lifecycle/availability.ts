import { DateTime } from "luxon";

import { getDateInTimezone } from "@/lib/utils/datetime";

const DEFAULT_LIFECYCLE_GRACE_MINUTES = 30;

export function isBookingLifecycleAllowedToday(params: {
  bookingDate: string | null | undefined;
  timezone: string;
  startTime?: string | null;
  endTime?: string | null;
  graceMinutes?: number;
  now?: Date;
}): boolean {
  if (!params.bookingDate) return false;
  const nowDate = params.now ?? new Date();
  const today = getDateInTimezone(nowDate, params.timezone);
  if (params.bookingDate === today) return true;

  const startTime = params.startTime?.trim();
  const endTime = params.endTime?.trim();
  if (!startTime || !endTime) return false;

  const now = DateTime.fromJSDate(nowDate, { zone: params.timezone });
  if (!now.isValid) return false;

  const start = DateTime.fromISO(`${params.bookingDate}T${startTime}`, { zone: params.timezone });
  if (!start.isValid) return false;

  let end = DateTime.fromISO(`${params.bookingDate}T${endTime}`, { zone: params.timezone });
  if (!end.isValid) return false;

  if (end <= start) {
    end = end.plus({ days: 1 });
  }

  const graceMinutes =
    typeof params.graceMinutes === "number" && Number.isFinite(params.graceMinutes)
      ? Math.max(0, params.graceMinutes)
      : DEFAULT_LIFECYCLE_GRACE_MINUTES;
  const endWithGrace = graceMinutes > 0 ? end.plus({ minutes: graceMinutes }) : end;

  return now >= start && now <= endWithGrace;
}
