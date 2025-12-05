import { fetchJson } from "@/lib/http/fetchJson";

import { buildBookingsSearchParams } from "../bookings-params";

import type { BookingsPort } from "../ports";

export const createClientBookingsPort = (): BookingsPort => ({
  async list(filters = {}) {
    const params = buildBookingsSearchParams(filters);
    return fetchJson(`/api/bookings?${params.toString()}`);
  },
});
