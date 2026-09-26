import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import {
  buildOperatingHoursReplacementRows,
  getOperatingHours,
  type OperatingHoursSnapshot,
  type UpdateOperatingHoursPayload,
} from '@/server/restaurants/operatingHours';
import {
  buildServicePeriodReplacementRows,
  getServicePeriods,
  type ServicePeriod,
  type UpdateServicePeriod,
} from '@/server/restaurants/servicePeriods';
import {
  buildTurnBandsSnapshot,
  type TurnBandsSnapshot,
} from '@/server/restaurants/turnBandDefaults';
import {
  getRestaurantTurnBands,
  normalizeTurnBandsPayload,
  type TurnBandsPayload,
} from '@/server/restaurants/turnBands';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

/** Booking-rule fields stored on `restaurants` that the Availability page edits. */
export type AvailabilityRulesInput = {
  reservationIntervalMinutes?: number;
  reservationDefaultDurationMinutes?: number;
  reservationLastSeatingBufferMinutes?: number;
  reservationLifecycleGraceMinutes?: number;
  bookingPolicy?: string | null;
};

export type AvailabilityRules = {
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  reservationLifecycleGraceMinutes: number;
  bookingPolicy: string | null;
  updatedAt: string | null;
};

/**
 * The restaurant-owned part of "Save availability". Each part present replaces that resource
 * completely; absent parts are left untouched. At least one part is required.
 */
export type AvailabilityCommandInput = {
  hours?: UpdateOperatingHoursPayload;
  servicePeriods?: UpdateServicePeriod[];
  turnBands?: TurnBandsPayload;
  rules?: AvailabilityRulesInput;
  /** Revision the caller loaded; a newer stored revision fails with STALE_WRITE. */
  expectedRevision?: string;
};

/** Canonical availability after a save, as stored. */
export type AvailabilitySnapshot = {
  restaurantId: string;
  revision: string;
  hours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriod[];
  turnBands: TurnBandsSnapshot;
  rules: AvailabilityRules;
};

export type AvailabilityCommandErrorCode =
  | 'STALE_WRITE'
  | 'SERVICE_PERIOD_OUTSIDE_HOURS'
  | 'UNKNOWN_BOOKING_TYPE'
  | 'INVALID_AVAILABILITY'
  | 'RESTAURANT_NOT_FOUND';

export type AvailabilityCommandPart = 'hours' | 'servicePeriods' | 'turnBands' | 'rules';

/** A known, safe-to-report command failure. Messages are fixed copy, never database text. */
export class AvailabilityCommandError extends Error {
  readonly code: AvailabilityCommandErrorCode;
  readonly status: 400 | 404 | 409;
  readonly part: AvailabilityCommandPart | null;

  constructor(
    code: AvailabilityCommandErrorCode,
    status: 400 | 404 | 409,
    message: string,
    part: AvailabilityCommandPart | null = null,
  ) {
    super(message);
    this.name = 'AvailabilityCommandError';
    this.code = code;
    this.status = status;
    this.part = part;
  }
}

const INVALID_PART_MESSAGE: Record<AvailabilityCommandPart, string> = {
  hours: 'Some opening hours or special dates are not valid.',
  servicePeriods: 'Some meal times are not valid.',
  turnBands: 'Some table times are not valid.',
  rules: 'Some booking rules are not valid.',
};

type RpcError = { code?: string; message?: string };

/** Maps the RPC's SQLSTATEs (see the migration header) to safe command errors. */
function mapRpcError(error: RpcError): Error {
  switch (error.code) {
    case 'NT409':
      return new AvailabilityCommandError(
        'STALE_WRITE',
        409,
        'These settings were changed somewhere else. Reload to see the latest, then reapply your edits.',
      );
    case 'NT422':
      return new AvailabilityCommandError(
        'SERVICE_PERIOD_OUTSIDE_HOURS',
        400,
        'A meal time falls outside that day’s opening hours.',
        'servicePeriods',
      );
    case '23503':
      return new AvailabilityCommandError(
        'UNKNOWN_BOOKING_TYPE',
        400,
        'A meal time or table time uses a booking type that does not exist.',
      );
    case 'P0002':
      return new AvailabilityCommandError('RESTAURANT_NOT_FOUND', 404, 'Restaurant not found.');
    case 'NT400':
    case 'P0001':
    case '22P02':
    case '22023':
    case '23502':
    case '23514':
      return new AvailabilityCommandError(
        'INVALID_AVAILABILITY',
        400,
        'Some availability settings are not valid.',
      );
    default: {
      // Unknown database failure: the route logs it and answers 500 without its text.
      const unexpected = new Error('save_restaurant_availability failed');
      unexpected.name = 'AvailabilityCommandRpcError';
      (unexpected as Error & { code?: string }).code = error.code;
      return unexpected;
    }
  }
}

/**
 * Booking-option keys the command accepts, read fresh (no process cache, so a booking type that
 * was just created on another instance is visible). Meal times may use any booking type that is
 * not deleted, including one that is turned off (its meal times still shape guest times), except
 * `drinks`; turn bands may use any existing key, as the turn-bands route allows.
 */
async function loadBookingOptionKeys(
  client: DbClient,
): Promise<{ servicePeriodOptions: Set<string>; turnBandOptions: Set<string> }> {
  const { data, error } = await client.from('booking_occasions').select('key, deleted_at');
  if (error) {
    throw error;
  }
  const servicePeriodOptions = new Set<string>();
  const turnBandOptions = new Set<string>();
  for (const row of data ?? []) {
    const key = row.key?.toString().trim().toLowerCase();
    if (!key) continue;
    turnBandOptions.add(key);
    if (!row.deleted_at && key !== 'drinks') {
      servicePeriodOptions.add(key);
    }
  }
  return { servicePeriodOptions, turnBandOptions };
}

function buildPart<T>(part: AvailabilityCommandPart, build: () => T): T {
  try {
    return build();
  } catch {
    // Domain validators throw plain Errors whose text can name staff-entered values; the
    // response uses fixed copy per part instead.
    throw new AvailabilityCommandError(
      'INVALID_AVAILABILITY',
      400,
      INVALID_PART_MESSAGE[part],
      part,
    );
  }
}

function toRulesRow(rules: AvailabilityRulesInput): Record<string, Json> {
  const row: Record<string, Json> = {};
  if (rules.reservationIntervalMinutes !== undefined) {
    row.reservation_interval_minutes = rules.reservationIntervalMinutes;
  }
  if (rules.reservationDefaultDurationMinutes !== undefined) {
    row.reservation_default_duration_minutes = rules.reservationDefaultDurationMinutes;
  }
  if (rules.reservationLastSeatingBufferMinutes !== undefined) {
    row.reservation_last_seating_buffer_minutes = rules.reservationLastSeatingBufferMinutes;
  }
  if (rules.reservationLifecycleGraceMinutes !== undefined) {
    row.reservation_lifecycle_grace_minutes = rules.reservationLifecycleGraceMinutes;
  }
  if (rules.bookingPolicy !== undefined) {
    const trimmed = rules.bookingPolicy?.trim() ?? '';
    row.booking_policy = trimmed.length > 0 ? trimmed : null;
  }
  return row;
}

export function hasAvailabilityCommandParts(input: AvailabilityCommandInput): boolean {
  return (
    input.hours !== undefined ||
    input.servicePeriods !== undefined ||
    input.turnBands !== undefined ||
    (input.rules !== undefined && Object.keys(toRulesRow(input.rules)).length > 0)
  );
}

async function getAvailabilityRules(
  restaurantId: string,
  client: DbClient,
): Promise<AvailabilityRules> {
  const { data, error } = await client
    .from('restaurants')
    .select(
      'reservation_interval_minutes, reservation_default_duration_minutes, reservation_last_seating_buffer_minutes, reservation_lifecycle_grace_minutes, booking_policy, updated_at',
    )
    .eq('id', restaurantId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new AvailabilityCommandError('RESTAURANT_NOT_FOUND', 404, 'Restaurant not found.');
  }
  return {
    reservationIntervalMinutes: data.reservation_interval_minutes,
    reservationDefaultDurationMinutes: data.reservation_default_duration_minutes,
    reservationLastSeatingBufferMinutes: data.reservation_last_seating_buffer_minutes,
    reservationLifecycleGraceMinutes:
      data.reservation_lifecycle_grace_minutes ?? DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
    bookingPolicy: data.booking_policy ?? null,
    updatedAt: data.updated_at ?? null,
  };
}

/** The current availability revision, for the command's optional precondition. */
export async function getAvailabilityRevision(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<string> {
  const { data, error } = await client.rpc('restaurant_availability_revision', {
    p_restaurant_id: restaurantId,
  });
  if (error) {
    throw mapRpcError(error);
  }
  if (typeof data !== 'string' || data.length === 0) {
    throw new AvailabilityCommandError('RESTAURANT_NOT_FOUND', 404, 'Restaurant not found.');
  }
  return data;
}

async function loadAvailabilitySnapshot(
  restaurantId: string,
  revision: string,
  client: DbClient,
): Promise<AvailabilitySnapshot> {
  const [hours, servicePeriods, bands, rules] = await Promise.all([
    getOperatingHours(restaurantId, client),
    getServicePeriods(restaurantId, client),
    getRestaurantTurnBands(restaurantId, client),
    getAvailabilityRules(restaurantId, client),
  ]);
  return {
    restaurantId,
    revision,
    hours,
    servicePeriods,
    turnBands: buildTurnBandsSnapshot(restaurantId, bands, servicePeriods),
    rules,
  };
}

/**
 * Saves the restaurant-owned part of the Availability page in one database transaction
 * (`save_restaurant_availability`) and returns the canonical stored state. The caller must
 * already have authorised a restaurant admin for `restaurantId`; this uses the service client.
 */
export async function saveRestaurantAvailability(
  restaurantId: string,
  input: AvailabilityCommandInput,
  client: DbClient = getServiceSupabaseClient(),
): Promise<AvailabilitySnapshot> {
  if (!hasAvailabilityCommandParts(input)) {
    throw new AvailabilityCommandError(
      'INVALID_AVAILABILITY',
      400,
      'Nothing to save: send at least one of hours, servicePeriods, turnBands or rules.',
    );
  }

  const options =
    input.servicePeriods !== undefined || input.turnBands !== undefined
      ? await loadBookingOptionKeys(client)
      : null;

  const hoursRows =
    input.hours !== undefined
      ? buildPart('hours', () => buildOperatingHoursReplacementRows(restaurantId, input.hours!))
      : null;
  const periodRows =
    input.servicePeriods !== undefined
      ? buildPart('servicePeriods', () =>
          buildServicePeriodReplacementRows(
            restaurantId,
            input.servicePeriods!.map((entry) => ({
              ...entry,
              bookingOption: entry.bookingOption.trim().toLowerCase(),
            })),
            options?.servicePeriodOptions ?? new Set(),
          ),
        )
      : null;
  const bandRows =
    input.turnBands !== undefined
      ? buildPart('turnBands', () =>
          Object.entries(
            normalizeTurnBandsPayload(input.turnBands!, options?.turnBandOptions),
          ).flatMap(([bookingOption, bands]) =>
            bands.map((band) => ({
              restaurant_id: restaurantId,
              booking_option: bookingOption,
              max_party_size: band.maxPartySize,
              duration_minutes: band.durationMinutes,
            })),
          ),
        )
      : null;
  const rulesRow =
    input.rules !== undefined && Object.keys(toRulesRow(input.rules)).length > 0
      ? toRulesRow(input.rules)
      : null;

  const { data, error } = await client.rpc('save_restaurant_availability', {
    p_restaurant_id: restaurantId,
    p_operating_hours: hoursRows as unknown as Json,
    p_service_periods: periodRows as unknown as Json,
    p_turn_bands: bandRows as unknown as Json,
    p_rules: rulesRow,
    p_expected_revision: input.expectedRevision ?? null,
  });
  if (error) {
    throw mapRpcError(error);
  }

  const revision =
    data && typeof data === 'object' && !Array.isArray(data) && typeof data.revision === 'string'
      ? data.revision
      : null;
  if (!revision) {
    throw mapRpcError({ code: 'UNEXPECTED_RESULT' });
  }

  return loadAvailabilitySnapshot(restaurantId, revision, client);
}
