import { apiClient } from '@shared/api/client';

import type { ReservationSchedule } from './timeSlots';

export const scheduleQueryKey = (
  restaurantSlug: string | null | undefined,
  date: string | null | undefined,
) => ['reservations', 'schedule', restaurantSlug ?? '', date ?? ''] as const;

export async function fetchReservationSchedule(
  restaurantSlug: string,
  date: string | null | undefined,
  signal?: AbortSignal,
): Promise<ReservationSchedule> {
  const params = new URLSearchParams();
  if (date) {
    params.set('date', date);
  }

  const encodedSlug = encodeURIComponent(restaurantSlug);
  const path =
    params.size > 0
      ? `/restaurants/${encodedSlug}/schedule?${params.toString()}`
      : `/restaurants/${encodedSlug}/schedule`;

  return apiClient.get<ReservationSchedule>(path, { signal });
}

export type CalendarMask = {
  timezone: string;
  from: string;
  to: string;
  closedDaysOfWeek: number[];
  closedDates: string[];
};

export const calendarMaskQueryKey = (
  restaurantSlug: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
) => ['reservations', 'calendar-mask', restaurantSlug ?? '', from ?? '', to ?? ''] as const;

export async function fetchCalendarMask(
  restaurantSlug: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<CalendarMask> {
  const params = new URLSearchParams();
  params.set('from', from);
  params.set('to', to);

  const encodedSlug = encodeURIComponent(restaurantSlug);
  const path = `/restaurants/${encodedSlug}/calendar-mask?${params.toString()}`;

  return apiClient.get<CalendarMask>(path, { signal });
}
