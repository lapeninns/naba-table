import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BOOKING_BLOCKING_STATUSES,
  BOOKING_TYPES_UI,
  SEATING_PREFERENCES_UI,
  ensureBookingStatus,
  ensureBookingType,
  ensureSeatingPreference,
  type BookingStatus,
  type BookingType,
  type SeatingPreference,
} from "@/lib/enums";
import { getCachedOccasionCatalog } from '@/server/occasions/catalog';
import type { Database, Json, Tables, TablesInsert } from "@/types/supabase";
import { generateBookingReference, generateUniqueBookingReference } from "./booking-reference";
import {
  findCustomerByContact,
  normalizeEmail,
  normalizePhone,
  recordBookingForCustomerProfile,
  recordCancellationForCustomerProfile,
  upsertCustomer,
} from "./customers";
import { invalidateAvailabilitySnapshot } from "./cache/availability";

export { generateBookingReference, generateUniqueBookingReference } from "./booking-reference";

type DbClient = SupabaseClient<Database, any, any>;
type BookingRow = Tables<"bookings">;

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

type UpdateBookingPayload = {
  restaurant_id?: string;
  booking_date?: string;
  start_time?: string;
  end_time?: string;
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
};

const TABLE_SELECT = "id,label,capacity,seating_type,features";
const BOOKING_SELECT = "*";

export const BOOKING_TYPES = BOOKING_TYPES_UI;
export const SEATING_OPTIONS = SEATING_PREFERENCES_UI;

const AUDIT_BOOKING_FIELDS: Array<keyof BookingRecord> = [
  "restaurant_id",
  "customer_id",
  "booking_date",
  "start_time",
  "end_time",
  "start_at",
  "end_at",
  "reference",
  "party_size",
  "booking_type",
  "seating_preference",
  "status",
  "customer_name",
  "customer_email",
  "customer_phone",
  "notes",
  "marketing_opt_in",
  "source",
  "client_request_id",
  "pending_ref",
  "idempotency_key",
  "details",
];

async function resolveWaitlistPosition(
  client: DbClient,
  params: { restaurantId: string; bookingDate: string; desiredTime: string; createdAt: string },
): Promise<number> {
  const { count, error } = await client
    .from("waiting_list")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", params.restaurantId)
    .eq("booking_date", params.bookingDate)
    .eq("desired_time", params.desiredTime)
    .lte("created_at", params.createdAt);

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
    const changed = Array.isArray(before) || Array.isArray(after)
      ? JSON.stringify(before) !== JSON.stringify(after)
      : before !== after;
    if (changed) {
      changes.push({ field, before, after });
    }
  }

  return { previous: prev, current: curr, changes };
}

export function minutesFromTime(time: string): number {
  const [hoursPart = "0", minutesPart = "0"] = time.split(":");
  const hours = Number(hoursPart) || 0;
  const minutes = Number(minutesPart) || 0;
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
    case "drinks":
      return 75;
    case "breakfast":
      return 75;
    case "lunch":
      return 90;
    default:
      return 120;
  }
}

export function inferMealTypeFromTime(time: string): BookingType {
  const totalMinutes = minutesFromTime(time);
  // Lunch service up to 16:59, dinner afterwards.
  return totalMinutes >= 17 * 60 ? "dinner" : "lunch";
}

export function deriveEndTime(startTime: string, bookingType: BookingType): string {
  const startMinutes = minutesFromTime(startTime);
  const endMinutes = startMinutes + calculateDurationMinutes(bookingType);
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
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("customer_id", customer.id)
    .in("status", BOOKING_BLOCKING_STATUSES)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function logAuditEvent(
  client: DbClient,
  params: { action: string; entity: string; entityId?: string | null; metadata?: Json; actor?: string | null }
): Promise<void> {
  const { error } = await client.from("audit_logs").insert({
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
  }
): Promise<{ id: string; position: number; existing: boolean } | null> {
  const seatingPreference = ensureSeatingPreference(payload.seating_preference);
  const email = normalizeEmail(payload.customer_email);
  const phoneNormalizedRaw = normalizePhone(payload.customer_phone);
  const hasPlusPrefix = payload.customer_phone.trim().startsWith("+");
  const phoneForStorage = hasPlusPrefix && phoneNormalizedRaw
    ? `+${phoneNormalizedRaw}`
    : phoneNormalizedRaw || payload.customer_phone.trim();

  const {
    data: existing,
    error: lookupError,
  } = await client
    .from("waiting_list")
    .select("id")
    .eq("restaurant_id", payload.restaurant_id)
    .eq("booking_date", payload.booking_date)
    .eq("desired_time", payload.desired_time)
    .eq("customer_email", email)
    .eq("customer_phone", phoneForStorage)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing?.id) {
    const { error: updateError } = await client
      .from("waiting_list")
      .update({
        party_size: payload.party_size,
        seating_preference: seatingPreference,
        notes: payload.notes ?? null,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw updateError;
    }

    const { data: entry, error: entryError } = await client
      .from("waiting_list")
      .select("id,created_at")
      .eq("id", existing.id)
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

  const { error } = await client.from("waiting_list").insert({
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
    .from("waiting_list")
    .select("id,created_at")
    .eq("restaurant_id", payload.restaurant_id)
    .eq("booking_date", payload.booking_date)
    .eq("desired_time", payload.desired_time)
    .eq("customer_email", email)
    .eq("customer_phone", phoneForStorage)
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

export async function softCancelBooking(client: DbClient, bookingId: string): Promise<BookingRecord> {
  const { data, error } = await client
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .select(BOOKING_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const booking = (data ?? null) as BookingRecord;

  await recordCancellationForCustomerProfile(client, {
    customerId: booking.customer_id,
    cancelledAt: booking.updated_at,
  });

  void invalidateAvailabilitySnapshot(booking.restaurant_id, booking.booking_date);

  return booking;
}

export async function updateBookingRecord(
  client: DbClient,
  bookingId: string,
  payload: UpdateBookingPayload,
): Promise<BookingRecord> {
  const nextPayload: UpdateBookingPayload = { ...payload };

  if (nextPayload.booking_type) {
    nextPayload.booking_type = ensureBookingType(nextPayload.booking_type);
  }
  if (nextPayload.seating_preference) {
    nextPayload.seating_preference = ensureSeatingPreference(nextPayload.seating_preference);
  }
  if (nextPayload.status) {
    nextPayload.status = ensureBookingStatus(nextPayload.status);
  }

  if ("details" in nextPayload && nextPayload.details === undefined) {
    nextPayload.details = null;
  }
  if ("idempotency_key" in nextPayload && nextPayload.idempotency_key === undefined) {
    nextPayload.idempotency_key = null;
  }

  const { data, error } = await client
    .from("bookings")
    .update(nextPayload)
    .eq("id", bookingId)
    .select(BOOKING_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const booking = data as BookingRecord;

  void invalidateAvailabilitySnapshot(booking.restaurant_id, booking.booking_date);

  return booking;
}

export async function insertBookingRecord(
  client: DbClient,
  payload: CreateBookingPayload,
): Promise<BookingRecord> {
  const bookingType = ensureBookingType(payload.booking_type);
  const seatingPreference = ensureSeatingPreference(payload.seating_preference);
  const status = ensureBookingStatus(payload.status ?? "confirmed");

  const insertPayload: TablesInsert<"bookings"> = {
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
    source: payload.source ?? "web",
    customer_id: payload.customer_id,
    client_request_id: payload.client_request_id,
    idempotency_key: payload.idempotency_key ?? null,
    details: payload.details ?? null,
  };

  if (payload.pending_ref) {
    insertPayload.pending_ref = payload.pending_ref;
  }

  const { data, error } = await client
    .from("bookings")
    .insert(insertPayload)
    .select(BOOKING_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const booking = data as BookingRecord;

  await recordBookingForCustomerProfile(client, {
    customerId: booking.customer_id,
    createdAt: booking.created_at,
    partySize: booking.party_size,
    marketingOptIn: booking.marketing_opt_in,
    status: booking.status,
  });

  void invalidateAvailabilitySnapshot(booking.restaurant_id, booking.booking_date);

  return booking;
}
