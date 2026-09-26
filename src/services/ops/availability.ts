import { fetchJson, type RequestSignalOptions } from '@/lib/http/fetchJson';

import { OPS_RESTAURANTS_BASE } from './restaurants';

import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  ServicePeriodRow,
  TurnBandsPayload,
  TurnBandsSnapshot,
} from './restaurants';

/**
 * Client for the Availability page's single save command
 * (`PUT /api/ops/restaurants/[id]/availability`). Standalone on purpose: it is not part of
 * `RestaurantService`, so the dev mock service does not need to implement it.
 */

/** Booking-rule fields stored on the restaurant that the Availability page edits. */
export type AvailabilityRulesPayload = Partial<
  Pick<
    RestaurantProfile,
    | 'reservationIntervalMinutes'
    | 'reservationDefaultDurationMinutes'
    | 'reservationLastSeatingBufferMinutes'
    | 'reservationLifecycleGraceMinutes'
    | 'bookingPolicy'
  >
>;

/**
 * One save of the restaurant-owned availability. Each part present replaces that resource;
 * absent parts are untouched. `expectedRevision` makes the save fail with 409 `STALE_WRITE` when
 * someone else saved since it was loaded.
 */
export type AvailabilityCommandPayload = {
  hours?: Pick<OperatingHoursSnapshot, 'weekly' | 'overrides'>;
  servicePeriods?: ServicePeriodRow[];
  turnBands?: TurnBandsPayload;
  rules?: AvailabilityRulesPayload;
  expectedRevision?: string;
};

export type AvailabilityRulesSnapshot = {
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  reservationLifecycleGraceMinutes: number;
  bookingPolicy: string | null;
  updatedAt: string | null;
};

/** The canonical stored availability after a save. */
export type AvailabilitySaveResult = {
  restaurantId: string;
  revision: string;
  hours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriodRow[];
  turnBands: TurnBandsSnapshot;
  rules: AvailabilityRulesSnapshot;
};

type DataEnvelope<T> = { data: T };

function availabilityUrl(restaurantId: string): string {
  return `${OPS_RESTAURANTS_BASE}/${encodeURIComponent(restaurantId)}/availability`;
}

export async function saveRestaurantAvailability(
  restaurantId: string,
  payload: AvailabilityCommandPayload,
): Promise<AvailabilitySaveResult> {
  const response = await fetchJson<DataEnvelope<AvailabilitySaveResult>>(
    availabilityUrl(restaurantId),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

export async function getRestaurantAvailabilityRevision(
  restaurantId: string,
  options?: RequestSignalOptions,
): Promise<string> {
  const response = await fetchJson<DataEnvelope<{ restaurantId: string; revision: string }>>(
    availabilityUrl(restaurantId),
    options,
  );
  return response.data.revision;
}
