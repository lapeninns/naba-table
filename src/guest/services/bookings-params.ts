import type { BookingsFilters } from "./ports";

export const GUEST_PORTAL_BOOKINGS_FILTERS = {
  page: 1,
  pageSize: 50,
} as const;

const toIsoString = (value?: Date | string | null): string | undefined => {
  if (!value) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

export const buildBookingsSearchParams = (filters: BookingsFilters = {}): URLSearchParams => {
  const params = new URLSearchParams({ me: "1" });

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.sort) {
    params.set("sort", filters.sort);
  }

  const from = toIsoString(filters.from);
  if (from) {
    params.set("from", from);
  }

  const to = toIsoString(filters.to);
  if (to) {
    params.set("to", to);
  }

  if (filters.restaurantId) {
    params.set("restaurantId", filters.restaurantId);
  }

  return params;
};

export const buildBookingsQueryKeyParams = (filters: BookingsFilters = {}): Record<string, string> =>
  Object.fromEntries(buildBookingsSearchParams(filters).entries());
