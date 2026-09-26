import { HttpError } from '@/lib/http/errors';
import { fetchJson, type RequestSignalOptions } from '@/lib/http/fetchJson';

import { OPS_RESTAURANTS_BASE } from './restaurants';

import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  RestaurantService,
  ServicePeriodRow,
  TurnBandsPayload,
  TurnBandsSnapshot,
} from './restaurants';

/**
 * Client for the Availability page's snapshot read and single save command
 * (`GET`/`PUT /api/ops/restaurants/[id]/availability`). Standalone on purpose: it is not part of
 * `RestaurantService`. The hooks take an {@link AvailabilityService} from context (see
 * `src/contexts/availability-service.tsx`); the dev harness adapts its in-memory
 * `RestaurantService` with {@link createRestaurantServiceAvailability}.
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

/**
 * The stored availability and the revision of exactly these rows, read in one database statement
 * (GET), or inside the save transaction (PUT).
 */
export type AvailabilitySnapshot = {
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
): Promise<AvailabilitySnapshot> {
  const response = await fetchJson<DataEnvelope<AvailabilitySnapshot>>(
    availabilityUrl(restaurantId),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

/**
 * The page's source of truth: rows and revision together, so a draft built from it can only be
 * saved over the state it was built from.
 */
export async function getRestaurantAvailability(
  restaurantId: string,
  options?: RequestSignalOptions,
): Promise<AvailabilitySnapshot> {
  const response = await fetchJson<DataEnvelope<AvailabilitySnapshot>>(
    availabilityUrl(restaurantId),
    options,
  );
  return response.data;
}

/** What the Availability hooks need; the HTTP client by default, an adapter in the dev harness. */
export type AvailabilityService = {
  getAvailability(
    restaurantId: string,
    options?: RequestSignalOptions,
  ): Promise<AvailabilitySnapshot>;
  saveAvailability(
    restaurantId: string,
    payload: AvailabilityCommandPayload,
  ): Promise<AvailabilitySnapshot>;
};

export const httpAvailabilityService: AvailabilityService = {
  getAvailability: getRestaurantAvailability,
  saveAvailability: saveRestaurantAvailability,
};

/** Deterministic, non-cryptographic content revision for the adapter (FNV-1a, 32 hex chars). */
function contentRevision(value: unknown): string {
  const text = JSON.stringify(value);
  let hex = '';
  for (let seed = 0; seed < 4; seed += 1) {
    let hash = 0x811c9dc5 ^ seed;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    hex += (hash >>> 0).toString(16).padStart(8, '0');
  }
  return hex;
}

/**
 * An {@link AvailabilityService} composed from a `RestaurantService` (the dev harness's in-memory
 * one). Not transactional: it exists so the Availability page works against mocks. It keeps the
 * command's contract (only the parts sent are written; a stale `expectedRevision` is refused
 * with 409 `STALE_WRITE`) so the page behaves as it does against the real route.
 */
export function createRestaurantServiceAvailability(
  service: RestaurantService,
): AvailabilityService {
  async function read(
    restaurantId: string,
    options?: RequestSignalOptions,
  ): Promise<AvailabilitySnapshot> {
    const [hours, servicePeriods, turnBands, profile] = await Promise.all([
      service.getOperatingHours(restaurantId, options),
      service.getServicePeriods(restaurantId, options),
      service.getTurnBands(restaurantId, options),
      service.getProfile(restaurantId, options),
    ]);
    const rules: AvailabilityRulesSnapshot = {
      reservationIntervalMinutes: profile.reservationIntervalMinutes,
      reservationDefaultDurationMinutes: profile.reservationDefaultDurationMinutes,
      reservationLastSeatingBufferMinutes: profile.reservationLastSeatingBufferMinutes,
      reservationLifecycleGraceMinutes: profile.reservationLifecycleGraceMinutes,
      bookingPolicy: profile.bookingPolicy ?? null,
      updatedAt: profile.updatedAt ?? null,
    };
    const revision = contentRevision({
      weekly: hours.weekly,
      overrides: hours.overrides,
      servicePeriods: servicePeriods.map(({ updatedAt: _updatedAt, ...row }) => row),
      bands: turnBands.bands,
      rules: { ...rules, updatedAt: null },
    });
    return { restaurantId, revision, hours, servicePeriods, turnBands, rules };
  }

  return {
    getAvailability: read,
    async saveAvailability(restaurantId, payload) {
      if (payload.expectedRevision) {
        const current = await read(restaurantId);
        if (current.revision !== payload.expectedRevision) {
          throw new HttpError({
            status: 409,
            code: 'STALE_WRITE',
            message: 'These settings were changed somewhere else.',
          });
        }
      }
      if (payload.rules && Object.keys(payload.rules).length > 0) {
        await service.updateProfile(restaurantId, payload.rules);
      }
      if (payload.hours) {
        await service.updateOperatingHours(restaurantId, payload.hours);
      }
      if (payload.servicePeriods) {
        await service.updateServicePeriods(restaurantId, payload.servicePeriods);
      }
      if (payload.turnBands) {
        await service.updateTurnBands(restaurantId, payload.turnBands);
      }
      return read(restaurantId);
    },
  };
}
