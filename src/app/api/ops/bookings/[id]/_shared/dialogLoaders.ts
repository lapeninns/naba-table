/**
 * Shared loaders for the ops booking dialog payload.
 *
 * Both the legacy single-purpose endpoints (`/api/ops/bookings/[id]` GET and
 * `/api/ops/bookings/[id]/assignment-context` GET) and the consolidated
 * `/api/ops/bookings/[id]/dialog` GET endpoint funnel through these loaders
 * so a single source of truth governs payload shapes.
 */

import { DateTime } from 'luxon';

import { getTenantServiceSupabaseClient } from '@/server/supabase';

import type { getServiceSupabaseClient } from '@/server/supabase';
import type { AssignmentContext } from '@/services/ops/bookings';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type ServiceClient = ReturnType<typeof getServiceSupabaseClient>;
type RestaurantClient = SupabaseClient<Database>;
const ASSIGNMENT_CONTEXT_QUERY_PADDING_MINUTES = 240;

export type LoaderError = {
  ok: false;
  status: number;
  error: string;
  code?: string;
};

export type BookingDetailPayload = {
  id: string;
  restaurantId: string | null;
  restaurantName: string;
  restaurantSlug: string | null;
  restaurantTimezone: string | null;
  reservationIntervalMinutes: number | null;
  partySize: number;
  startTime: string | null;
  startIso: string;
  endIso: string;
  status: string;
  notes: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  reference: string | null;
  source: string | null;
  seatingPreference: string | null;
  marketingOptIn: boolean;
  tableAssignments: Array<{
    groupId: string | null;
    capacitySum: number;
    members: Array<{
      tableId: string;
      tableNumber: string;
      capacity: number | null;
      section: string | null;
    }>;
  }>;
  requiresTableAssignment: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  details: Record<string, unknown> | null;
};

function toIsoString(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function deriveFallbackIso(
  date: string | null | undefined,
  time: string | null | undefined,
  timezone: string | null | undefined,
): string {
  if (!date || !time) return '';
  const zone = typeof timezone === 'string' && timezone.trim().length > 0 ? timezone : 'UTC';
  const trimmed = time.trim();
  if (trimmed.length === 0) return '';
  const normalized = trimmed.length === 5 ? `${trimmed}:00` : trimmed;
  const dt = DateTime.fromISO(`${date}T${normalized}`, { zone });
  if (!dt.isValid) return '';
  return dt.toUTC().toISO() ?? '';
}

/**
 * Load and shape the ops booking detail payload. Caller is responsible for
 * authentication and membership authorization. Returns `{ ok: false }` for
 * not-found or DB errors so handlers can map them to HTTP responses.
 */
export async function loadBookingDetailPayload(params: {
  serviceSupabase: ServiceClient;
  bookingId: string;
  /** Optional tenant guard – when provided the booking must belong to this restaurant. */
  restaurantIdFilter?: string;
}): Promise<{ ok: true; payload: BookingDetailPayload; restaurantId: string } | LoaderError> {
  const { serviceSupabase, bookingId, restaurantIdFilter } = params;

  let query = serviceSupabase
    .from('bookings')
    .select(
      `
      id,
      restaurant_id,
      start_at,
      end_at,
      booking_date,
      start_time,
      end_time,
      party_size,
      status,
      notes,
      customer_name,
      customer_email,
      customer_phone,
      client_request_id,
      source,
      seating_preference,
      marketing_opt_in,
      checked_in_at,
      checked_out_at,
      details,
      restaurants (
        name,
        slug,
        timezone,
        reservation_interval_minutes
      ),
      booking_table_assignments (
        table_id,
        merge_group_id,
        table_inventory (
          table_number,
          capacity,
          section
        )
      )
    `,
    )
    .eq('id', bookingId);

  if (restaurantIdFilter) {
    query = query.eq('restaurant_id', restaurantIdFilter);
  }

  const { data: booking, error } = await query.maybeSingle();

  if (error) {
    console.error('[dialog-loader] failed to load booking', { bookingId, error });
    return { ok: false, status: 500, error: 'Unable to load booking' };
  }

  if (!booking) {
    return { ok: false, status: 404, error: 'Booking not found' };
  }

  const restaurantRelation = Array.isArray(booking.restaurants)
    ? (booking.restaurants[0] ?? null)
    : (booking.restaurants ?? null);

  const reservationIntervalMinutes =
    restaurantRelation && typeof restaurantRelation.reservation_interval_minutes === 'number'
      ? restaurantRelation.reservation_interval_minutes
      : null;

  const restaurantTimezone =
    restaurantRelation && typeof restaurantRelation.timezone === 'string'
      ? restaurantRelation.timezone
      : null;

  const startIso =
    toIsoString(booking.start_at) ||
    deriveFallbackIso(booking.booking_date, booking.start_time, restaurantTimezone);

  const endIso =
    toIsoString(booking.end_at) ||
    deriveFallbackIso(booking.booking_date, booking.end_time, restaurantTimezone);

  const rawPhone = typeof booking.customer_phone === 'string' ? booking.customer_phone.trim() : '';
  const customerPhone = rawPhone.length > 0 ? rawPhone : null;

  const rawAssignments = booking.booking_table_assignments as unknown as Array<{
    table_id: string;
    merge_group_id: string | null;
    table_inventory: {
      table_number: string;
      capacity: number;
      section: string | null;
    } | null;
  }> | null;

  const grouped = new Map<
    string,
    {
      groupId: string | null;
      members: Array<{
        tableId: string;
        tableNumber: string;
        capacity: number | null;
        section: string | null;
      }>;
    }
  >();

  for (const assignment of rawAssignments ?? []) {
    const key = assignment.merge_group_id ?? `single-${assignment.table_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, { groupId: assignment.merge_group_id, members: [] });
    }
    const inventory = assignment.table_inventory;
    grouped.get(key)!.members.push({
      tableId: assignment.table_id,
      tableNumber: inventory?.table_number ?? '?',
      capacity: inventory?.capacity ?? null,
      section: inventory?.section ?? null,
    });
  }

  const tableAssignments = Array.from(grouped.values()).map((group) => ({
    groupId: group.groupId,
    capacitySum: group.members.reduce((sum, m) => sum + (m.capacity ?? 0), 0),
    members: group.members,
  }));

  const payload: BookingDetailPayload = {
    id: booking.id,
    restaurantId: booking.restaurant_id ?? null,
    restaurantName: restaurantRelation?.name ?? '',
    restaurantSlug: restaurantRelation?.slug ?? null,
    restaurantTimezone: restaurantRelation?.timezone ?? null,
    reservationIntervalMinutes,
    partySize: booking.party_size,
    startTime: booking.start_time,
    startIso,
    endIso,
    status: booking.status,
    notes: booking.notes ?? null,
    customerName: booking.customer_name ?? null,
    customerEmail: booking.customer_email ?? null,
    customerPhone,
    reference: booking.client_request_id ?? null,
    source: booking.source ?? null,
    seatingPreference: booking.seating_preference ?? null,
    marketingOptIn: booking.marketing_opt_in ?? false,
    tableAssignments,
    requiresTableAssignment:
      tableAssignments.length === 0 &&
      booking.status !== 'cancelled' &&
      booking.status !== 'no_show',
    checkedInAt: booking.checked_in_at ?? null,
    checkedOutAt: booking.checked_out_at ?? null,
    details: (booking.details as Record<string, unknown> | null) ?? null,
  };

  return { ok: true, payload, restaurantId: booking.restaurant_id };
}

/**
 * Load and shape the assignment-context payload. Caller must have already
 * authorized the booking against the tenant.
 */
export async function loadAssignmentContextPayload(params: {
  serviceSupabase: ServiceClient;
  restaurantClient?: RestaurantClient;
  bookingId: string;
  restaurantId: string;
}): Promise<{ ok: true; payload: AssignmentContext } | LoaderError> {
  const [
    { getVenuePolicy },
    { buildBusyMaps, extractConflictsForTables },
    { computeBookingWindowWithFallback },
    { cleanupOrphanedAssignments },
    { toIsoUtc },
  ] = await Promise.all([
    import('@/server/capacity/policy'),
    import('@/server/capacity/table-assignment/availability'),
    import('@/server/capacity/table-assignment/booking-window'),
    import('@/server/capacity/table-assignment/direct-assignment'),
    import('@/server/capacity/table-assignment/utils'),
  ]);

  const { serviceSupabase, bookingId, restaurantId } = params;
  const restaurantClient = params.restaurantClient ?? getTenantServiceSupabaseClient(restaurantId);

  const bookingQuery = await serviceSupabase
    .from('bookings')
    .select(
      'id, restaurant_id, start_at, booking_date, start_time, party_size, status, restaurants(timezone)',
    )
    .eq('id', bookingId)
    .eq('restaurant_id', restaurantId)
    .single();

  if (bookingQuery.error || !bookingQuery.data) {
    return { ok: false, status: 404, error: 'Booking not found', code: 'BOOKING_NOT_FOUND' };
  }

  const booking = bookingQuery.data;
  const restaurantTimezone = Array.isArray(booking.restaurants)
    ? (booking.restaurants[0]?.timezone ?? null)
    : (booking.restaurants?.timezone ?? null);

  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });
  const contextWindowStart = toIsoUtc(
    window.block.start.minus({ minutes: ASSIGNMENT_CONTEXT_QUERY_PADDING_MINUTES }),
  );
  const contextWindowEnd = toIsoUtc(
    window.block.end.plus({ minutes: ASSIGNMENT_CONTEXT_QUERY_PADDING_MINUTES }),
  );

  const contextBookingsQuery = restaurantClient
    .from('bookings')
    .select(
      'id, start_at, end_at, status, party_size, start_time, end_time, booking_date, booking_type, booking_table_assignments(table_id)',
    )
    .eq('restaurant_id', restaurantId)
    .eq('booking_date', booking.booking_date)
    .or(
      `start_at.is.null,end_at.is.null,and(start_at.lt.${contextWindowEnd},end_at.gt.${contextWindowStart})`,
    );

  const [tablesResult, contextBookingsResult, bookingAssignmentsResult] = await Promise.all([
    restaurantClient
      .from('table_inventory')
      .select(
        'id, table_number, capacity, min_party_size, max_party_size, section, category, seating_type, mobility, zone_id, active, position, status, zone:zones(active)',
      )
      .eq('restaurant_id', restaurantId)
      .order('table_number', { ascending: true }),
    contextBookingsQuery,
    restaurantClient
      .from('booking_table_assignments')
      .select('table_id')
      .eq('booking_id', bookingId),
  ]);

  if (tablesResult.error || contextBookingsResult.error || bookingAssignmentsResult.error) {
    return {
      ok: false,
      status: 500,
      error: 'Failed to load assignment context',
      code: 'CONTEXT_LOAD_FAILED',
    };
  }

  const tables = tablesResult.data.map((table) => {
    const zoneActive =
      (table as unknown as { zone?: { active?: boolean | null } }).zone?.active ?? null;
    const status = (table as { status?: string | null }).status ?? null;
    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : null;
    const raw = table as Record<string, unknown>;
    return {
      id: raw.id as string,
      tableNumber: raw.table_number as string,
      name: undefined,
      capacity: raw.capacity as number,
      minPartySize: raw.min_party_size as number,
      maxPartySize: raw.max_party_size as number | null,
      section: raw.section as string | null,
      category: raw.category as string,
      seatingType: raw.seating_type as string,
      mobility: raw.mobility as string,
      zoneId: raw.zone_id as string,
      zoneActive,
      status: normalizedStatus,
      active: raw.active as boolean,
      position: raw.position as Record<string, unknown> | null,
    };
  });

  const validTableIds = new Set(tables.map((t) => t.id));
  const rawBookingAssignments = bookingAssignmentsResult.data.map((a) => a.table_id);
  const bookingAssignments = rawBookingAssignments.filter((tableId) => validTableIds.has(tableId));

  if (rawBookingAssignments.length !== bookingAssignments.length) {
    const orphanedIds = rawBookingAssignments.filter((id) => !validTableIds.has(id));
    console.warn('[dialog-loader] orphaned table assignments detected', {
      bookingId,
      orphanedCount: orphanedIds.length,
    });
    cleanupOrphanedAssignments({
      bookingId,
      orphanedTableIds: orphanedIds,
      client: restaurantClient,
    }).catch((err) => {
      console.error('[dialog-loader] failed to cleanup orphaned assignments', {
        bookingId,
        orphanedIds,
        error: err,
      });
    });
  }

  const busy = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookingsResult.data.map((b) => ({ ...b })),
    holds: [],
    policy,
    targetWindow: window,
  });

  const conflicts = extractConflictsForTables(
    busy,
    tables.map((table) => table.id),
    window,
  );

  // The loader returns the same payload shape the legacy route handler
  // produced; the AssignmentContext type uses slightly stricter shapes for
  // tables/conflicts than the underlying DB rows expose, so we cast through
  // unknown to preserve runtime parity with the previous endpoint.
  const payload = {
    booking,
    timezone: restaurantTimezone,
    tables,
    conflicts,
    bookingAssignments,
    window: {
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
    },
    serverNow: toIsoUtc(DateTime.now()),
  } as unknown as AssignmentContext;

  return { ok: true, payload };
}
