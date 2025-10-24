import { apiClient } from '@shared/api/client';

export type ClosedDaysResponse = {
  timezone: string;
  closed: string[];
};

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function fetchClosedDaysForRange(
  restaurantSlug: string,
  start: Date,
  end: Date,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const params = new URLSearchParams({ start: toIsoDate(start), end: toIsoDate(end) });
  const path = `/restaurants/${encodeURIComponent(restaurantSlug)}/closed-days?${params.toString()}`;
  const response = await apiClient.get<ClosedDaysResponse>(path, { signal });
  return new Set(response.closed ?? []);
}

export const closedDaysQueryKey = (slug: string, start: Date, end: Date) =>
  ['reservations', 'closed-days', slug, toIsoDate(start), toIsoDate(end)] as const;
