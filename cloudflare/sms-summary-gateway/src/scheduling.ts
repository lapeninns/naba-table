import { DateTime } from 'luxon';

import { DEFAULT_SEND_LOCAL_TIME, SEND_WINDOW_MINUTES } from './contracts';

import type { DueDispatch, RestaurantDailySummaryTarget } from './contracts';

function coerceUtcDateTime(value: Date | string): DateTime {
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: 'utc' });
  }

  return DateTime.fromISO(value, { zone: 'utc' });
}

export function resolveDueDispatch(params: { now: Date | string; timezone: string }): DueDispatch {
  const now = coerceUtcDateTime(params.now).setZone(params.timezone);
  const localDate = now.toISODate();

  if (!localDate) {
    return {
      localDate: '',
      dueNow: false,
      sendAtIso: null,
      windowEndsIso: null,
    };
  }

  const sendAt = DateTime.fromISO(`${localDate}T${DEFAULT_SEND_LOCAL_TIME}`, {
    zone: params.timezone,
  });
  const windowEnds = sendAt.plus({ minutes: SEND_WINDOW_MINUTES });

  return {
    localDate,
    dueNow: now >= sendAt && now < windowEnds,
    sendAtIso: sendAt.toUTC().toISO(),
    windowEndsIso: windowEnds.toUTC().toISO(),
  };
}

export function selectDueDispatches(
  targets: RestaurantDailySummaryTarget[],
  now: Date | string,
): Array<RestaurantDailySummaryTarget & DueDispatch> {
  return targets
    .filter((target) => target.enabled)
    .map((target) => ({
      ...target,
      ...resolveDueDispatch({
        now,
        timezone: target.timezone,
      }),
    }))
    .filter((target) => target.dueNow);
}
