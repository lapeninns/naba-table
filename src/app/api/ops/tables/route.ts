/**
 * Table Inventory Management API
 * Story 4: Ops Dashboard - Tables CRUD
 *
 * Endpoints:
 * - GET /api/ops/tables - List all tables for a restaurant
 * - POST /api/ops/tables - Create new table
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  conflict,
  forbidden,
  internalError,
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
import {
  findTableByNumber,
  insertTable,
  listTables,
  listTablesWithSummary,
} from '@/server/ops/tables';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireMembershipForRestaurant } from '@/server/team/access';

import type { TablesInsert } from '@/types/supabase';
import type { NextRequest } from 'next/server';

// =====================================================
// Request Validation
// =====================================================

const tableStatusEnum = z.enum(TABLE_STATUS_VALUES);
const tableCategoryEnum = z.enum(TABLE_CATEGORY_VALUES);
const tableSeatingEnum = z.enum(TABLE_SEATING_TYPE_VALUES);
const tableMobilityEnum = z.enum(TABLE_MOBILITY_VALUES);

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  section: z.string().optional(),
  status: tableStatusEnum.optional(),
  zoneId: z.string().uuid().optional(),
  includeSummary: z.enum(['0', '1', 'true', 'false']).optional(),
});

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  tableNumber: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(20),
  minPartySize: z.number().int().min(1).default(1),
  maxPartySize: z.number().int().min(1).max(20).optional().nullable(),
  category: tableCategoryEnum.default('dining'),
  seatingType: tableSeatingEnum.default('standard'),
  mobility: tableMobilityEnum.default('movable'),
  zoneId: z.string().uuid(),
  active: z.boolean().default(true),
  section: z.string().max(100).optional().nullable(),
  status: tableStatusEnum.default('available'),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
      rotation: z.number().optional(),
    })
    .optional()
    .nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const ROUTE = 'ops/tables';

function tableNumberTaken() {
  return conflict('TABLE_NUMBER_TAKEN', 'Another table already uses that number.');
}

// =====================================================
// GET /api/ops/tables - List tables
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthenticated();
    }

    const paramEntries = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(paramEntries);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { restaurantId, section, status, zoneId, includeSummary } = parsed.data;

    try {
      await requireMembershipForRestaurant({
        userId: user.id,
        restaurantId,
        client: supabase,
      });
    } catch {
      return forbidden();
    }

    const filters = {
      section: section && section.trim().length > 0 ? section : undefined,
      status,
      zoneId,
    } as const;

    const shouldIncludeSummary = includeSummary
      ? includeSummary !== '0' && includeSummary !== 'false'
      : true;

    const result = shouldIncludeSummary
      ? await listTablesWithSummary(supabase, restaurantId, filters)
      : { tables: await listTables(supabase, restaurantId, filters), summary: null };

    const { tables, summary } = result;

    return NextResponse.json({
      tables,
      summary,
    });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-tables' },
    });
    return internalError(error, { route: ROUTE, method: 'GET' });
  }
}

// =====================================================
// POST /api/ops/tables - Create table
// =====================================================

export async function POST(req: NextRequest) {
  return withCsrfProtectedMutation(req, () => postTable(req));
}

async function postTable(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthenticated();
    }

    const body = await req.json().catch(() => null);
    const parsed = createTableSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const data = parsed.data;

    const { data: membership, error: membershipError } = await supabase
      .from('restaurant_memberships')
      .select('role')
      .eq('restaurant_id', data.restaurantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return forbidden();
    }

    if (!isRestaurantAdminRole(membership.role)) {
      return forbidden('INSUFFICIENT_ROLE', 'Only owners and managers can change tables.');
    }

    const maxPartySize = data.maxPartySize ?? null;
    if (maxPartySize !== null && maxPartySize < data.minPartySize) {
      return apiError(400, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { maxPartySize: ['Largest party must be at least the smallest party.'] },
      });
    }

    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .select('id, restaurant_id')
      .eq('id', data.zoneId)
      .maybeSingle();

    if (zoneError || !zone || zone.restaurant_id !== data.restaurantId) {
      return apiError(400, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { zoneId: ['Choose a zone in this restaurant.'] },
      });
    }

    try {
      const existing = await findTableByNumber(
        supabase,
        data.restaurantId,
        data.tableNumber.trim(),
      );
      if (existing) {
        return tableNumberTaken();
      }
    } catch (lookupError) {
      captureServerException(lookupError, {
        distinctId: user.id,
        groups: { restaurant: data.restaurantId },
        properties: { restaurantId: data.restaurantId, source: 'ops', kind: 'ops-tables' },
      });
      return internalError(lookupError, {
        route: ROUTE,
        method: 'POST',
        restaurantId: data.restaurantId,
      });
    }

    const insertPayload = {
      restaurant_id: data.restaurantId,
      table_number: data.tableNumber.trim(),
      capacity: data.capacity,
      min_party_size: data.minPartySize,
      max_party_size: maxPartySize,
      section: data.section ? data.section.trim() || null : null,
      category: data.category,
      seating_type: data.seatingType,
      mobility: data.mobility,
      zone_id: data.zoneId,
      active: data.active,
      status: data.status,
      position: data.position ?? null,
      notes: data.notes ? data.notes.trim() || null : null,
    } satisfies TablesInsert<'table_inventory'>;

    try {
      const table = await insertTable(supabase, insertPayload);
      return NextResponse.json(
        {
          table: {
            ...table,
          },
        },
        { status: 201 },
      );
    } catch (createError) {
      const errorCode =
        typeof createError === 'object' && createError && 'code' in createError
          ? (createError as { code?: string }).code
          : undefined;

      if (errorCode === '23505') {
        // The pre-check above races another operator; the unique constraint is the authority.
        return tableNumberTaken();
      }
      if (errorCode === '23503') {
        return apiError(
          422,
          'CAPACITY_NOT_CONFIGURED',
          'That table size isn’t set up for this restaurant yet.',
        );
      }

      captureServerException(createError, {
        distinctId: user.id,
        groups: { restaurant: data.restaurantId },
        properties: { restaurantId: data.restaurantId, source: 'ops', kind: 'ops-tables' },
      });
      return internalError(createError, {
        route: ROUTE,
        method: 'POST',
        restaurantId: data.restaurantId,
      });
    }
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-tables' },
    });
    return internalError(error, { route: ROUTE, method: 'POST' });
  }
}
