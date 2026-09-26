import { z } from 'zod';

import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import {
  buildOperatingHoursReplacementRows,
  mapOperatingHoursRows,
  type OperatingHoursSnapshot,
  type UpdateOperatingHoursPayload,
} from '@/server/restaurants/operatingHours';
import {
  buildServicePeriodReplacementRows,
  mapServicePeriodRows,
  type ServicePeriod,
  type UpdateServicePeriod,
} from '@/server/restaurants/servicePeriods';
import {
  buildTurnBandsSnapshot,
  type TurnBandsSnapshot,
} from '@/server/restaurants/turnBandDefaults';
import { normalizeTurnBandsPayload, type TurnBandsPayload } from '@/server/restaurants/turnBands';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { TurnBandsByOption } from '@/server/capacity/policy';
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

export type AvailabilityCommandPart = 'hours' | 'servicePeriods' | 'turnBands' | 'rules';

export const AVAILABILITY_COMMAND_PARTS: readonly AvailabilityCommandPart[] = [
  'hours',
  'servicePeriods',
  'turnBands',
  'rules',
];

/** One content revision per section, so a save is only checked against what it writes. */
export type AvailabilitySectionRevisions = Record<AvailabilityCommandPart, string>;

/**
 * The restaurant-owned part of "Save availability". Each part present replaces that resource
 * completely; absent parts are left untouched. At least one part is required.
 */
export type AvailabilityCommandInput = {
  hours?: UpdateOperatingHoursPayload;
  servicePeriods?: UpdateServicePeriod[];
  turnBands?: TurnBandsPayload;
  rules?: AvailabilityRulesInput;
  /**
   * Section revisions the caller loaded. Only the sections this save writes are checked: a newer
   * stored revision of one of them fails with STALE_WRITE; other sections may have changed.
   * Takes precedence over `expectedRevision`.
   */
  expectedRevisions?: Partial<AvailabilitySectionRevisions>;
  /**
   * Whole-page revision the caller loaded (callers that predate per-section revisions); any newer
   * stored revision fails with STALE_WRITE.
   */
  expectedRevision?: string;
};

/** Canonical availability after a save, as stored. */
export type AvailabilitySnapshot = {
  restaurantId: string;
  /** Whole-page revision (a hash of `revisions`). */
  revision: string;
  revisions: AvailabilitySectionRevisions;
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

const nullableString = z.string().nullable().optional();

/** What `restaurant_availability_snapshot` (and `save_restaurant_availability`) return. */
const snapshotRowSchema = z.object({
  revision: z.string().min(1),
  revisions: z.object({
    hours: z.string().min(1),
    servicePeriods: z.string().min(1),
    turnBands: z.string().min(1),
    rules: z.string().min(1),
  }),
  restaurant: z.object({
    timezone: z.string(),
    reservation_interval_minutes: z.number(),
    reservation_default_duration_minutes: z.number(),
    reservation_last_seating_buffer_minutes: z.number(),
    reservation_lifecycle_grace_minutes: z.number().nullable().optional(),
    booking_policy: nullableString,
    updated_at: nullableString,
  }),
  operating_hours: z.array(
    z.object({
      id: z.string(),
      day_of_week: z.number().nullable(),
      effective_date: nullableString,
      opens_at: z.string().nullable(),
      closes_at: z.string().nullable(),
      is_closed: z.boolean().nullable(),
      notes: z.string().nullable(),
      reservation_interval_minutes: z.number().nullable(),
      reservation_slot_times: z.array(z.string()).nullable(),
      updated_at: z.string().nullable(),
    }),
  ),
  service_periods: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      day_of_week: z.number().nullable(),
      start_time: z.string(),
      end_time: z.string(),
      booking_option: z.string(),
      updated_at: z.string().nullable(),
    }),
  ),
  turn_bands: z.array(
    z.object({
      booking_option: z.string(),
      max_party_size: z.number(),
      duration_minutes: z.number(),
    }),
  ),
});

function groupTurnBands(rows: z.infer<typeof snapshotRowSchema>['turn_bands']): TurnBandsByOption {
  const grouped: TurnBandsByOption = {};
  for (const row of rows) {
    const key = row.booking_option.trim().toLowerCase();
    if (!key) continue;
    (grouped[key] ??= []).push({
      maxPartySize: row.max_party_size,
      durationMinutes: row.duration_minutes,
    });
  }
  Object.values(grouped).forEach((bands) => bands.sort((a, b) => a.maxPartySize - b.maxPartySize));
  return grouped;
}

/**
 * Maps the snapshot jsonb (rows and revision from ONE database read) to the API shape. The
 * hours, periods and bands use the same mappers as the single-resource reads.
 */
export function mapAvailabilitySnapshot(
  restaurantId: string,
  value: unknown,
): AvailabilitySnapshot {
  const parsed = snapshotRowSchema.safeParse(value);
  if (!parsed.success) {
    throw mapRpcError({ code: 'UNEXPECTED_RESULT' });
  }
  const row = parsed.data;
  const servicePeriods = mapServicePeriodRows(row.service_periods);
  return {
    restaurantId,
    revision: row.revision,
    revisions: row.revisions,
    hours: mapOperatingHoursRows({
      restaurantId,
      timezone: row.restaurant.timezone,
      weeklyRows: row.operating_hours.filter((hour) => !hour.effective_date),
      overrideRows: row.operating_hours.filter((hour) => Boolean(hour.effective_date)),
    }),
    servicePeriods,
    turnBands: buildTurnBandsSnapshot(restaurantId, groupTurnBands(row.turn_bands), servicePeriods),
    rules: {
      reservationIntervalMinutes: row.restaurant.reservation_interval_minutes,
      reservationDefaultDurationMinutes: row.restaurant.reservation_default_duration_minutes,
      reservationLastSeatingBufferMinutes: row.restaurant.reservation_last_seating_buffer_minutes,
      reservationLifecycleGraceMinutes:
        row.restaurant.reservation_lifecycle_grace_minutes ??
        DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
      bookingPolicy: row.restaurant.booking_policy ?? null,
      updatedAt: row.restaurant.updated_at ?? null,
    },
  };
}

/**
 * The stored availability and its revision, read in one statement
 * (`restaurant_availability_snapshot`), so the revision always describes exactly these rows. The
 * Availability page builds its draft from this and sends the revision back as the precondition.
 */
export async function getAvailabilitySnapshot(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<AvailabilitySnapshot> {
  const { data, error } = await client.rpc('restaurant_availability_snapshot', {
    p_restaurant_id: restaurantId,
  });
  if (error) {
    throw mapRpcError(error);
  }
  if (data === null || data === undefined) {
    throw new AvailabilityCommandError('RESTAURANT_NOT_FOUND', 404, 'Restaurant not found.');
  }
  return mapAvailabilitySnapshot(restaurantId, data);
}

/**
 * Saves the restaurant-owned part of the Availability page in one database transaction
 * (`save_restaurant_availability`) and returns the canonical stored state from that transaction. The caller must
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
    p_expected_revisions: input.expectedRevisions ?? null,
  });
  if (error) {
    throw mapRpcError(error);
  }

  // The RPC returns the stored state read inside its own transaction, so the response matches
  // the committed save and its revision exactly (no follow-up reads that could fail or race).
  return mapAvailabilitySnapshot(restaurantId, data);
}
