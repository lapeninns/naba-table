/**
 * Table Inventory Management API - Single Table
 * Story 4: Ops Dashboard - Table CRUD (Update, Delete)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  conflict,
  forbidden,
  internalError,
  notFound,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import {
  TABLE_CATEGORY_VALUES,
  TABLE_MOBILITY_VALUES,
  TABLE_SEATING_TYPE_VALUES,
  TABLE_STATUS_VALUES,
} from '@/lib/ops/table-inventory-reference';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { captureServerException } from '@/lib/posthog/server';
import { fetchTableById, fetchTableRecord, updateTableAtomically } from '@/server/ops/tables';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import {
  getRouteHandlerSupabaseClient,
  getServiceSupabaseClient,
  getTenantServiceSupabaseClient,
} from '@/server/supabase';

import type { TablesUpdate } from '@/types/supabase';
import type { NextRequest } from 'next/server';

const tableStatusEnum = z.enum(TABLE_STATUS_VALUES);
const tableCategoryEnum = z.enum(TABLE_CATEGORY_VALUES);
const tableSeatingEnum = z.enum(TABLE_SEATING_TYPE_VALUES);
const tableMobilityEnum = z.enum(TABLE_MOBILITY_VALUES);

const isoDateTimeString = z
  .string()
  .refine((value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)), {
    message: 'Enter a valid date and time.',
  });

const maintenanceSchema = z
  .object({
    startIso: isoDateTimeString,
    endIso: isoDateTimeString,
    // Accepted for compatibility; allocations have no reason column, so it is not stored.
    reason: z.string().max(200).optional().nullable(),
  })
  .refine((value) => new Date(value.endIso).getTime() > new Date(value.startIso).getTime(), {
    message: 'Maintenance must end after it starts.',
    path: ['endIso'],
  });

const updateTableSchema = z
  .object({
    tableNumber: z.string().trim().min(1).max(50).optional(),
    capacity: z.number().int().min(1).max(20).optional(),
    minPartySize: z.number().int().min(1).optional(),
    maxPartySize: z.number().int().min(1).max(20).optional().nullable(),
    category: tableCategoryEnum.optional(),
    seatingType: tableSeatingEnum.optional(),
    mobility: tableMobilityEnum.optional(),
    zoneId: z.string().uuid().optional(),
    active: z.boolean().optional(),
    section: z.string().max(100).optional().nullable(),
    status: tableStatusEnum.optional(),
    position: z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        rotation: z.number().finite().min(-360).max(360).optional(),
      })
      .optional()
      .nullable(),
    notes: z.string().max(500).optional().nullable(),
    maintenance: maintenanceSchema.optional(),
  })
  .refine((value) => !value.maintenance || value.status === 'out_of_service', {
    message: 'A maintenance window needs the table to be out of service.',
    path: ['maintenance'],
  });

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ROUTE = 'ops/tables/[id]';

function coerceNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** The function raises P0002 with one of these fixed tokens; nothing else is read from the text. */
function isZoneNotFound(error: unknown): boolean {
  return (
    errorCodeOf(error) === 'P0002' &&
    error instanceof Object &&
    'message' in error &&
    (error as { message?: unknown }).message === 'zone_not_found'
  );
}

function forbiddenForTables() {
  return forbidden('INSUFFICIENT_ROLE', 'Only owners and managers can change tables.');
}

function buildUpdatePayload(
  updates: z.infer<typeof updateTableSchema>,
): TablesUpdate<'table_inventory'> {
  const payload: TablesUpdate<'table_inventory'> = {};
  if (updates.tableNumber !== undefined) payload.table_number = updates.tableNumber;
  if (updates.capacity !== undefined) payload.capacity = updates.capacity;
  if (updates.minPartySize !== undefined) payload.min_party_size = updates.minPartySize;
  if (updates.maxPartySize !== undefined) payload.max_party_size = updates.maxPartySize;
  if (updates.section !== undefined) payload.section = coerceNullableString(updates.section);
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.seatingType !== undefined) payload.seating_type = updates.seatingType;
  if (updates.mobility !== undefined) payload.mobility = updates.mobility;
  if (updates.zoneId !== undefined) payload.zone_id = updates.zoneId;
  if (updates.active !== undefined) payload.active = updates.active;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.position !== undefined) payload.position = updates.position ?? null;
  if (updates.notes !== undefined) payload.notes = coerceNullableString(updates.notes);
  return payload;
}

/** Maps the atomic update's database errors to C1 responses; database text never leaves. */
function mapUpdateError(error: unknown, ctx: { restaurantId: string; userId: string }) {
  switch (errorCodeOf(error)) {
    case '23505':
      return conflict('TABLE_NUMBER_TAKEN', 'Another table already uses that number.');
    case '23P01':
      return conflict(
        'MAINTENANCE_CONFLICT',
        'That maintenance window overlaps a hold or booking on this table.',
      );
    case '23503':
      return apiError(
        422,
        'CAPACITY_NOT_CONFIGURED',
        'That table size isn’t set up for this restaurant yet.',
      );
    case 'P0002':
      return isZoneNotFound(error)
        ? apiError(400, 'VALIDATION_FAILED', 'Some fields need attention.', {
            fields: { zoneId: ['Choose a zone in this restaurant.'] },
          })
        : notFound('TABLE_NOT_FOUND', 'Table not found.');
    case '22023':
    case '22P02':
    case '23502':
    case '23514':
      return apiError(400, 'VALIDATION_FAILED', 'Some fields need attention.');
    default:
      captureServerException(error, {
        distinctId: ctx.userId,
        groups: { restaurant: ctx.restaurantId },
        properties: { restaurantId: ctx.restaurantId, source: 'ops', kind: 'ops-table' },
      });
      return internalError(error, {
        route: ROUTE,
        method: 'PATCH',
        restaurantId: ctx.restaurantId,
      });
  }
}

// =====================================================
// PATCH /api/ops/tables/[id] - Update table
// =====================================================

export async function PATCH(req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(req, () => patchTable(req, context));
}

async function patchTable(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthenticated();
    }

    const { id: tableId } = await context.params;
    const existingTable = await fetchTableById(supabase, tableId);

    if (!existingTable) {
      return notFound('TABLE_NOT_FOUND', 'Table not found.');
    }

    const restaurantId = existingTable.restaurant_id;
    const { data: membership, error: membershipError } = await supabase
      .from('restaurant_memberships')
      .select('role')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return forbidden();
    }

    if (!isRestaurantAdminRole(membership.role)) {
      return forbiddenForTables();
    }

    const body = await req.json().catch(() => null);
    const parsed = updateTableSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const updates = parsed.data;
    const desiredMinPartySize = updates.minPartySize ?? existingTable.min_party_size;
    const desiredMaxPartySize =
      updates.maxPartySize !== undefined ? updates.maxPartySize : existingTable.max_party_size;

    if (desiredMaxPartySize !== null && desiredMaxPartySize < desiredMinPartySize) {
      return apiError(400, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { maxPartySize: ['Largest party must be at least the smallest party.'] },
      });
    }

    const patch = buildUpdatePayload(updates);
    const maintenance = updates.maintenance
      ? {
          startIso: new Date(updates.maintenance.startIso).toISOString(),
          endIso: new Date(updates.maintenance.endIso).toISOString(),
        }
      : null;

    if (Object.keys(patch).length > 0) {
      try {
        // One transaction for the row and its maintenance window (migration 20260927130000).
        await updateTableAtomically(getTenantServiceSupabaseClient(restaurantId), {
          tableId,
          restaurantId,
          patch,
          maintenance,
          actorId: user.id,
        });
      } catch (updateError) {
        return mapUpdateError(updateError, { restaurantId, userId: user.id });
      }
    }

    const table = await fetchTableRecord(supabase, restaurantId, tableId);
    if (!table) {
      return notFound('TABLE_NOT_FOUND', 'Table not found.');
    }

    return NextResponse.json({ table });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-table' },
    });
    return internalError(error, { route: ROUTE, method: 'PATCH' });
  }
}

// =====================================================
// DELETE /api/ops/tables/[id] - Delete table
// =====================================================

export async function DELETE(_req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(_req, () => deleteTable(_req, context));
}

async function deleteTable(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthenticated();
    }

    const { id: tableId } = await context.params;
    const table = await fetchTableById(supabase, tableId);

    if (!table) {
      return notFound('TABLE_NOT_FOUND', 'Table not found.');
    }

    const { data: membership, error: membershipError } = await supabase
      .from('restaurant_memberships')
      .select('role')
      .eq('restaurant_id', table.restaurant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return forbidden();
    }

    if (!isRestaurantAdminRole(membership.role)) {
      return forbidden('INSUFFICIENT_ROLE', 'Only owners and managers can delete tables.');
    }

    const currentDate = new Date().toISOString().slice(0, 10);
    const serviceClient = getServiceSupabaseClient();

    const { data: deleted, error: deleteError } = await serviceClient.rpc(
      'delete_table_inventory_guarded',
      {
        p_table_id: tableId,
        p_current_date: currentDate,
      },
    );

    if (deleteError) {
      // The guarded delete raises this fixed text; it is matched, never forwarded.
      if (/active or future booking assignments/i.test(deleteError.message ?? '')) {
        return conflict(
          'TABLE_HAS_BOOKINGS',
          'This table has current or upcoming bookings. Move, complete or cancel them first.',
        );
      }
      captureServerException(deleteError, {
        distinctId: user.id,
        groups: { restaurant: table.restaurant_id },
        properties: { restaurantId: table.restaurant_id, source: 'ops', kind: 'ops-table' },
      });
      return internalError(deleteError, {
        route: ROUTE,
        method: 'DELETE',
        restaurantId: table.restaurant_id,
      });
    }

    if (!deleted) {
      return notFound('TABLE_NOT_FOUND', 'Table not found.');
    }

    return NextResponse.json({ success: true, deletedTableNumber: table.table_number });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-table' },
    });
    return internalError(error, { route: ROUTE, method: 'DELETE' });
  }
}
