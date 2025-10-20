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
