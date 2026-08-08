// --- IGNORE ---
import { createHash, randomUUID } from 'node:crypto';

import {
  BOOKING_BLOCKING_STATUSES,
  BOOKING_TYPES_UI,
  SEATING_PREFERENCES_UI,
  ensureBookingType,
  ensureBookingStatus,
  ensureSeatingPreference,
  type BookingStatus,
  type BookingType,
  type SeatingPreference,
} from '@/lib/enums';
import { getCachedOccasionCatalog } from '@/server/occasions/catalog';
import { assertActiveOccasionKey } from '@/server/occasions/validateBookingType';
import { formatUKPhoneToE164 } from '@reserve/shared/validation';

import { computeTokenExpiry, generateConfirmationToken } from './bookings/confirmation-token';
import {
  findCustomerByContact,
  normalizeEmail,
  normalizePhone,
  recordBookingForCustomerProfile,
  recordCancellationForCustomerProfile,
} from './customers';

import type { Database, Json, Tables, TablesInsert } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export { generateBookingReference, generateUniqueBookingReference } from './booking-reference';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = SupabaseClient<Database, any, any>;
type BookingRow = Tables<'bookings'>;
type UpdateBookingAndClearAssignmentsRpcClient = DbClient & {
  rpc: (
    fn: 'update_booking_and_clear_assignments',
    args: {
      p_booking_id: string;
      p_patch: Json;
      p_restaurant_id: string;
    },
  ) => Promise<{ data: BookingRecord | null; error: { message: string } | null }>;
};

export type BookingRecord = BookingRow;

type CreateBookingPayload = {
  restaurant_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  party_size: number;
  booking_type: BookingType;
  seating_preference: SeatingPreference;
  status?: BookingStatus;
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes?: string | null;
  marketing_opt_in?: boolean;
  loyalty_points_awarded?: number;
  source?: string;
  customer_id: string;
  auth_user_id?: string | null;
  client_request_id: string;
  pending_ref?: string;
  idempotency_key?: string | null;
  details?: Json | null;
};

export type UpdateBookingPayload = {
  restaurant_id?: string;
  booking_date?: string;
  start_time?: string;
  end_time?: string;
  start_at?: string | null;
  end_at?: string | null;
  party_size?: number;
  booking_type?: BookingType;
  seating_preference?: SeatingPreference;
  status?: BookingStatus;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  notes?: string | null;
  marketing_opt_in?: boolean;
  loyalty_points_awarded?: number;
  source?: string;
  auth_user_id?: string | null;
  details?: Json | null;
  idempotency_key?: string | null;
  auto_assign_last_result?: Json | null;
};

const BOOKING_SELECT = '*';

export const BOOKING_TYPES = BOOKING_TYPES_UI;
export const SEATING_OPTIONS = SEATING_PREFERENCES_UI;

function buildAutoAssignIdempotencyKey(params: {
  bookingId: string;
  restaurantId: string;
  bookingDate: string;
  startTime: string;
  partySize: number;
}): string {
  const payload = `${params.bookingId}|${params.restaurantId}|${params.partySize}|${params.bookingDate}T${params.startTime}`;
  const digest = createHash('sha256').update(payload).digest('hex').slice(0, 12);
  return `booking-${params.bookingId}-auto-assign-${digest}`;
}

const AUDIT_BOOKING_FIELDS: Array<keyof BookingRecord> = [
  'restaurant_id',
  'customer_id',
  'booking_date',
  'start_time',
  'end_time',
  'start_at',
  'end_at',
  'reference',
  'party_size',
  'booking_type',
  'seating_preference',
  'status',
  'customer_name',
  'customer_email',
  'customer_phone',
  'notes',
  'marketing_opt_in',
  'source',
  'client_request_id',
  'pending_ref',
  'idempotency_key',
  'details',
];

async function resolveWaitlistPosition(
  client: DbClient,
  params: { restaurantId: string; bookingDate: string; desiredTime: string; createdAt: string },
): Promise<number> {
  const { count, error } = await client
    .from('waiting_list')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', params.restaurantId)
    .eq('booking_date', params.bookingDate)
    .eq('desired_time', params.desiredTime)
    .lte('created_at', params.createdAt);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function pickBookingFields(source: Partial<BookingRecord> | null | undefined) {
  if (!source) return null;
  const picked: Partial<Record<keyof BookingRecord, Json>> = {};
  for (const field of AUDIT_BOOKING_FIELDS) {
    if (field in source) {
      const value = source[field];
      picked[field] = (value ?? null) as Json;
    }
  }
  return picked;
}

export function buildBookingAuditSnapshot(
  previous: Partial<BookingRecord> | null | undefined,
  current: Partial<BookingRecord> | null | undefined,
): {
  previous: Partial<Record<keyof BookingRecord, Json>> | null;
  current: Partial<Record<keyof BookingRecord, Json>> | null;
  changes: Array<{ field: keyof BookingRecord; before: Json; after: Json }>;
} {
  const prev = pickBookingFields(previous);
  const curr = pickBookingFields(current);
  const changes: Array<{ field: keyof BookingRecord; before: Json; after: Json }> = [];

  for (const field of AUDIT_BOOKING_FIELDS) {
    const before = prev ? (prev[field] ?? null) : null;
    const after = curr ? (curr[field] ?? null) : null;
    const changed =
      Array.isArray(before) || Array.isArray(after)
        ? JSON.stringify(before) !== JSON.stringify(after)
        : before !== after;
    if (changed) {
      changes.push({ field, before, after });
    }
  }

  return { previous: prev, current: curr, changes };
}

export function minutesFromTime(time: string): number {
  const [hoursPart = '0', minutesPart = '0'] = time.split(':');
  const hours = Number(hoursPart) || 0;
  const minutes = Number(minutesPart) || 0;
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function calculateDurationMinutes(bookingType: BookingType): number {
  const normalized = bookingType?.toString().trim().toLowerCase();
  if (normalized) {
    const catalog = getCachedOccasionCatalog();
    const definition = catalog.byKey.get(normalized);
    if (definition) {
      return definition.defaultDurationMinutes;
    }
  }

  switch (normalized) {
    case 'lunch':
      return 90;
    default:
      return 120;
  }
}

export function inferMealTypeFromTime(time: string): BookingType {
  const totalMinutes = minutesFromTime(time);
  // Lunch service up to 16:59, dinner afterwards.
  return totalMinutes >= 17 * 60 ? 'dinner' : 'lunch';
}

export function deriveEndTime(startTime: string, bookingType: BookingType): string {
  return deriveEndTimeFromDuration(startTime, calculateDurationMinutes(bookingType));
}

export function deriveEndTimeFromDuration(startTime: string, durationMinutes: number): string {
  const startMinutes = minutesFromTime(startTime);
  const endMinutes = startMinutes + Math.max(1, Math.round(durationMinutes));
  return minutesToTime(endMinutes);
}

export function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const startMinutesA = minutesFromTime(startA);
  const endMinutesA = minutesFromTime(endA);
  const startMinutesB = minutesFromTime(startB);
  const endMinutesB = minutesFromTime(endB);

  return startMinutesA < endMinutesB && endMinutesA > startMinutesB;
}

export async function fetchBookingsForContact(
  client: DbClient,
  restaurantId: string,
  email: string,
  phone: string,
): Promise<BookingRecord[]> {
  const customer = await findCustomerByContact(client, restaurantId, email, phone);
  if (!customer) {
    return [];
  }

  const { data, error } = await client
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('restaurant_id', restaurantId)
    .eq('customer_id', customer.id)
    .in('status', BOOKING_BLOCKING_STATUSES)
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function logAuditEvent(
  client: DbClient,
  params: {
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Json;
    actor?: string | null;
  },
): Promise<void> {
  const { error } = await client.from('audit_logs').insert({
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? null,
    actor: params.actor?.trim() ? params.actor.trim() : undefined,
  });

  if (error) {
    throw error;
  }
}

export async function addToWaitingList(
  client: DbClient,
  payload: {
    restaurant_id: string;
    booking_date: string;
    desired_time: string;
    party_size: number;
    seating_preference: SeatingPreference;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    notes?: string | null;
  },
): Promise<{ id: string; position: number; existing: boolean } | null> {
  const seatingPreference = ensureSeatingPreference(payload.seating_preference);
  const email = normalizeEmail(payload.customer_email);
  const trimmedPhone = payload.customer_phone.trim();
  const canonicalUkPhone = formatUKPhoneToE164(trimmedPhone);
  const phoneNormalizedRaw = normalizePhone(payload.customer_phone);
  const phoneForStorage = canonicalUkPhone ?? (phoneNormalizedRaw || trimmedPhone);
  const legacyPhoneForLookup = trimmedPhone.startsWith('+')
    ? trimmedPhone
    : trimmedPhone.replace(/[^0-9]/g, '') || trimmedPhone;
  const waitlistPhoneCandidates = Array.from(
    new Set([phoneForStorage, legacyPhoneForLookup].filter((value) => value.length > 0)),
  );

  const { data: existing, error: lookupError } = await client
    .from('waiting_list')
    .select('id')
    .eq('restaurant_id', payload.restaurant_id)
    .eq('booking_date', payload.booking_date)
    .eq('desired_time', payload.desired_time)
    .eq('customer_email', email)
    .in('customer_phone', waitlistPhoneCandidates)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing?.id) {
    const { error: updateError } = await client
      .from('waiting_list')
      .update({
        party_size: payload.party_size,
        seating_preference: seatingPreference,
        customer_phone: phoneForStorage,
        notes: payload.notes ?? null,
      })
      .eq('id', existing.id);

    if (updateError) {
      throw updateError;
    }

    const { data: entry, error: entryError } = await client
      .from('waiting_list')
      .select('id,created_at')
      .eq('id', existing.id)
      .maybeSingle();

    if (entryError) {
      throw entryError;
    }

    if (!entry) {
      return null;
    }

    const position = await resolveWaitlistPosition(client, {
      restaurantId: payload.restaurant_id,
      bookingDate: payload.booking_date,
      desiredTime: payload.desired_time,
      createdAt: entry.created_at,
    });

    return { id: entry.id, position, existing: true };
  }

  const { error } = await client.from('waiting_list').insert({
    restaurant_id: payload.restaurant_id,
    booking_date: payload.booking_date,
    desired_time: payload.desired_time,
    party_size: payload.party_size,
    seating_preference: seatingPreference,
    customer_name: payload.customer_name,
    customer_email: email,
    customer_phone: phoneForStorage,
    notes: payload.notes ?? null,
  });

  if (error) {
    throw error;
  }

  const { data: created, error: createdError } = await client
    .from('waiting_list')
    .select('id,created_at')
    .eq('restaurant_id', payload.restaurant_id)
    .eq('booking_date', payload.booking_date)
    .eq('desired_time', payload.desired_time)
    .eq('customer_email', email)
    .in('customer_phone', waitlistPhoneCandidates)
    .maybeSingle();

  if (createdError) {
    throw createdError;
  }

  if (!created) {
    return null;
  }

  const position = await resolveWaitlistPosition(client, {
    restaurantId: payload.restaurant_id,
    bookingDate: payload.booking_date,
    desiredTime: payload.desired_time,
    createdAt: created.created_at,
  });

  return { id: created.id, position, existing: false };
}

export async function softCancelBooking(
  client: DbClient,
  bookingId: string,
  options: { restaurantId: string },
): Promise<{ booking: BookingRecord; cancelled: boolean }> {
  const { data, error } = await client.rpc('cancel_booking_and_release_table_state', {
    p_booking_id: bookingId,
    p_restaurant_id: options.restaurantId,
  });

  if (error) {
    throw error;
  }

  const result = data?.[0];
  if (!result) {
    throw new Error(`Cancellation returned no booking for ${bookingId}`);
  }

  const { booking, cancelled } = result;

  if (cancelled) {
    try {
      await recordCancellationForCustomerProfile(client, {
        customerId: booking.customer_id,
        cancelledAt: booking.updated_at,
      });
    } catch (profileError) {
      logCustomerProfileMaintenanceFailure('cancellation', profileError);
    }
  }

  return { booking, cancelled };
}

function logCustomerProfileMaintenanceFailure(context: string, error: unknown): void {
  console.warn(`[bookings] ${context} customer profile maintenance failed`, {
    error: stringifyAssignmentCleanupError(error),
  });
}

async function normalizeUpdateBookingPayload(
  payload: UpdateBookingPayload,
): Promise<UpdateBookingPayload> {
  const nextPayload: UpdateBookingPayload = { ...payload };

  if (nextPayload.booking_type) {
    const activeKey = await assertActiveOccasionKey(nextPayload.booking_type);
    nextPayload.booking_type = ensureBookingType(activeKey);
  }
  if (nextPayload.seating_preference) {
    nextPayload.seating_preference = ensureSeatingPreference(nextPayload.seating_preference);
  }
  if (nextPayload.status) {
    nextPayload.status = ensureBookingStatus(nextPayload.status);
  }

  if ('details' in nextPayload && nextPayload.details === undefined) {
    nextPayload.details = null;
  }
  if ('idempotency_key' in nextPayload && nextPayload.idempotency_key === undefined) {
    nextPayload.idempotency_key = null;
  }

  return nextPayload;
}

export async function updateBookingRecord(
  client: DbClient,
  bookingId: string,
  payload: UpdateBookingPayload,
  options: { restaurantId?: string | null } = {},
): Promise<BookingRecord> {
  const nextPayload = await normalizeUpdateBookingPayload(payload);

  let query = client.from('bookings').update(nextPayload).eq('id', bookingId);

  if (options.restaurantId) {
    query = query.eq('restaurant_id', options.restaurantId);
  }

  const { data, error } = await query.select(BOOKING_SELECT).single();

  if (error) {
    throw error;
  }

  const booking = data as BookingRecord;

  return booking;
}

export async function updateBookingAndClearAssignmentsAtomically(
  client: DbClient,
  bookingId: string,
  payload: UpdateBookingPayload,
  options: { restaurantId: string },
): Promise<BookingRecord> {
  const nextPayload = await normalizeUpdateBookingPayload(payload);
  const { data, error } = await (client as UpdateBookingAndClearAssignmentsRpcClient).rpc(
    'update_booking_and_clear_assignments',
    {
      p_booking_id: bookingId,
      p_patch: nextPayload as Json,
      p_restaurant_id: options.restaurantId,
    },
  );

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`update_booking_and_clear_assignments returned no booking for ${bookingId}`);
  }

  return data;
}

type TableAssignmentRow = {
  table_id: string | null;
};

function stringifyAssignmentCleanupError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function assertAssignmentCleanupSucceeded(
  error: unknown,
  context: string,
  bookingId: string,
): void {
  if (!error) return;
  throw new Error(
    `Failed to clear booking table assignments (${context}) for ${bookingId}: ${stringifyAssignmentCleanupError(error)}`,
  );
}

export async function clearBookingTableAssignments(
  client: DbClient,
  bookingId: string,
): Promise<number> {
  const { data, error } = await client
    .from('booking_table_assignments')
    .select('table_id')
    .eq('booking_id', bookingId);

  if (error) {
    throw error;
  }

  const tableIds = (data ?? [])
    .map((row: TableAssignmentRow) => row.table_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (tableIds.length > 0) {
    const { error: rpcError } = await client.rpc('unassign_tables_atomic', {
      p_booking_id: bookingId,
      p_table_ids: tableIds,
    });

    if (rpcError) {
      console.warn('[bookings] unassign_tables_atomic failed; falling back to delete', {
        bookingId,
        tableIds,
        error: stringifyAssignmentCleanupError(rpcError),
      });

      const { error: deleteError } = await client
        .from('booking_table_assignments')
        .delete()
        .eq('booking_id', bookingId);
      assertAssignmentCleanupSucceeded(deleteError, 'fallback delete', bookingId);
    }
  }

  // Clear zone lock so reassignment can select a different zone after tables are released.
  const { error: zoneError } = await client
    .from('bookings')
    .update({ assigned_zone_id: null })
    .eq('id', bookingId);
  assertAssignmentCleanupSucceeded(zoneError, 'zone lock clear', bookingId);

  // Clear idempotency records to prevent duplicate key errors on reassignment.
  const { error: idempotencyError } = await client
    .from('booking_assignment_idempotency')
    .delete()
    .eq('booking_id', bookingId);
  assertAssignmentCleanupSucceeded(idempotencyError, 'idempotency cleanup', bookingId);

  return tableIds.length;
}

export async function insertBookingRecord(
  client: DbClient,
  payload: CreateBookingPayload,
): Promise<BookingRecord> {
  const bookingType = await assertActiveOccasionKey(payload.booking_type);
  const seatingPreference = ensureSeatingPreference(payload.seating_preference);
  const status = ensureBookingStatus(payload.status ?? 'pending');

  const bookingId = randomUUID();
  const autoAssignKey = buildAutoAssignIdempotencyKey({
    bookingId,
    restaurantId: payload.restaurant_id,
    bookingDate: payload.booking_date,
    startTime: payload.start_time,
    partySize: payload.party_size,
  });

  const insertPayload: TablesInsert<'bookings'> = {
    id: bookingId,
    restaurant_id: payload.restaurant_id,
    booking_date: payload.booking_date,
    start_time: payload.start_time,
    end_time: payload.end_time,
    reference: payload.reference,
    party_size: payload.party_size,
    booking_type: bookingType,
    seating_preference: seatingPreference,
    status,
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
    customer_phone: payload.customer_phone,
    notes: payload.notes ?? null,
    marketing_opt_in: payload.marketing_opt_in ?? false,
    loyalty_points_awarded: payload.loyalty_points_awarded ?? 0,
    source: payload.source ?? 'web',
    customer_id: payload.customer_id,
    client_request_id: payload.client_request_id,
    idempotency_key: payload.idempotency_key ?? null,
    details: payload.details ?? null,
    auto_assign_idempotency_key: autoAssignKey,
    confirmation_token: generateConfirmationToken(),
    confirmation_token_expires_at: computeTokenExpiry(24 * 30), // 30 days expiry
  };

  if (payload.pending_ref) {
    insertPayload.pending_ref = payload.pending_ref;
  }

  const { data, error } = await client
    .from('bookings')
    .insert(insertPayload)
    .select(BOOKING_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const booking = data as BookingRecord;

  try {
    await recordBookingForCustomerProfile(client, {
      customerId: booking.customer_id,
      createdAt: booking.created_at,
      partySize: booking.party_size,
      marketingOptIn: booking.marketing_opt_in,
      status: booking.status,
    });
  } catch (profileError) {
    logCustomerProfileMaintenanceFailure('booking', profileError);
  }

  return booking;
}
