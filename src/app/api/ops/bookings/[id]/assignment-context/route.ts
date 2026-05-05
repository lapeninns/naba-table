import { DateTime } from 'luxon';
import { NextResponse } from 'next/server';

import { withBookingAuthorization } from '@/server/auth/guards';
import { getVenuePolicy } from '@/server/capacity/policy';
import {
  buildBusyMaps,
  extractConflictsForTables,
} from '@/server/capacity/table-assignment/availability';
import { computeBookingWindowWithFallback } from '@/server/capacity/table-assignment/booking-window';
import { cleanupOrphanedAssignments } from '@/server/capacity/table-assignment/direct-assignment';
import { toIsoUtc } from '@/server/capacity/table-assignment/utils';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient, getTenantServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

/**
 * GET /api/ops/bookings/{id}/assignment-context
 *
 * A simplified context endpoint for the direct assignment UI.
 * It provides the necessary data to render the floor plan and its state for a given booking.
 * This replaces the legacy `manual-context` endpoint.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const bookingId = params.id;
  const authorization = await withBookingAuthorization(req, bookingId, {
    action: 'assignment-context:read',
  });
  if (!authorization.ok) {
    return authorization.response;
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'ops-bookings:assignment-context',
    tenantId: authorization.restaurantId,
    userId: authorization.user.id,
    limit: 45,
    windowMs: 60_000,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const serviceSupabase = getServiceSupabaseClient();

  // 1. Load the target booking after route-level tenant authorization.
  const bookingQuery = await serviceSupabase
    .from('bookings')
    .select(
      'id, restaurant_id, start_at, booking_date, start_time, party_size, status, restaurants(timezone)',
    )
    .eq('id', bookingId)
    .eq('restaurant_id', authorization.restaurantId)
    .single();

  if (bookingQuery.error || !bookingQuery.data) {
    return NextResponse.json(
      { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
      { status: 404 },
    );
  }
  const booking = bookingQuery.data;
  const restaurantId = authorization.restaurantId;
  const restaurantTimezone = Array.isArray(booking.restaurants)
    ? (booking.restaurants[0]?.timezone ?? null)
    : (booking.restaurants?.timezone ?? null);

  // Create a restaurant-scoped service client for subsequent queries
  const restaurantClient = getTenantServiceSupabaseClient(restaurantId);

  // 2. Compute the booking's time window
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  // 3. Load all necessary data in parallel
  // IMPORTANT: Explicitly filter by restaurant_id to match what loadTablesByIds does,
  // ensuring consistent table visibility between context and assignment operations
  const [tablesResult, contextBookingsResult, bookingAssignmentsResult] = await Promise.all([
    restaurantClient
      .from('table_inventory')
      .select('*, zone:zones(active)')
      .eq('restaurant_id', restaurantId)
      .order('table_number', { ascending: true }),
    restaurantClient
      .from('bookings')
      .select(
        'id, start_at, end_at, status, party_size, start_time, end_time, booking_date, booking_table_assignments(table_id)',
      )
      .eq('restaurant_id', restaurantId)
      .eq('booking_date', booking.booking_date),
    restaurantClient
      .from('booking_table_assignments')
      .select('table_id')
      .eq('booking_id', bookingId),
  ]);

  if (tablesResult.error || contextBookingsResult.error || bookingAssignmentsResult.error) {
    // Basic error handling, can be made more granular
    return NextResponse.json(
      { error: 'Failed to load assignment context', code: 'CONTEXT_LOAD_FAILED' },
      { status: 500 },
    );
  }

  const tables = tablesResult.data.map((table) => {
    const zoneActive =
      (table as unknown as { zone?: { active?: boolean | null } }).zone?.active ?? null;
    const status = (table as { status?: string | null }).status ?? null;
    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : null;

    // Explicitly map snake_case database fields to camelCase
    const raw = table as Record<string, unknown>;
    return {
      id: raw.id as string,
      tableNumber: raw.table_number as string,
      name: raw.name as string | null | undefined,
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

  // Build a set of valid table IDs for quick lookup
  const validTableIds = new Set(tables.map((t) => t.id));

  const contextBookings = contextBookingsResult.data;

  // Filter out orphaned assignments where the table no longer exists
  // This prevents TABLES_NOT_FOUND errors when the user tries to assign tables
  const rawBookingAssignments = bookingAssignmentsResult.data.map((a) => a.table_id);
  const bookingAssignments = rawBookingAssignments.filter((tableId) => validTableIds.has(tableId));

  // Clean up orphaned assignments from the database if any were detected
  if (rawBookingAssignments.length !== bookingAssignments.length) {
    const orphanedIds = rawBookingAssignments.filter((id) => !validTableIds.has(id));
    console.warn('[assignment-context] detected orphaned table assignments', {
      bookingId,
      orphanedCount: orphanedIds.length,
      orphanedTableIds: orphanedIds,
    });

    // Clean up orphaned assignments in the background (don't block the response)
    // This ensures the database is consistent for future requests
    cleanupOrphanedAssignments({
      bookingId,
      orphanedTableIds: orphanedIds,
      client: restaurantClient,
    }).catch((err) => {
      console.error('[assignment-context] failed to cleanup orphaned assignments', {
        bookingId,
        orphanedIds,
        error: err,
      });
    });
  }

  // 4. Calculate conflicts
  // Note: The old context included holds, but the new direct-assignment model deprecates them.
  // We only need to build the busy map from other confirmed/checked_in bookings.
  const busy = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookings.map((b) => ({
      ...b,
      // Ensure the structure matches what buildBusyMaps expects
      // ContextBookingRow expects booking_table_assignments, which we fetched.
      // The query returns it as an array of objects, which matches the type.
    })),
    holds: [], // No holds in the new system
    policy,
    targetWindow: window,
  });

  const conflicts = extractConflictsForTables(
    busy,
    tables.map((table) => table.id),
    window,
  );

  // 5. Construct the response payload
  const context = {
    booking,
    timezone: restaurantTimezone,
    tables,
    conflicts,
    bookingAssignments,
    // The new context is much simpler. No complex versioning.
    window: {
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
    },
    serverNow: toIsoUtc(DateTime.now()),
  };

  return NextResponse.json(context, { status: 200 });
}
