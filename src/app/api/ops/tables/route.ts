/**
 * Table Inventory Management API
 * Story 4: Ops Dashboard - Tables CRUD
 *
 * Endpoints:
 * - GET /api/ops/tables - List all tables for a restaurant
 * - POST /api/ops/tables - Create new table
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureAllowedCapacity, findTableByNumber, insertTable, listTablesWithSummary } from "@/server/ops/tables";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

import type { TablesInsert } from "@/types/supabase";
import type { NextRequest} from "next/server";

// =====================================================
// Request Validation
// =====================================================

const tableStatusEnum = z.enum(["available", "reserved", "occupied", "out_of_service"]);
const tableCategoryEnum = z.enum(["bar", "dining", "lounge", "patio", "private"]);
const tableSeatingEnum = z.enum(["standard", "sofa", "booth", "high_top"]);
const tableMobilityEnum = z.enum(["movable", "fixed"]);

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  section: z.string().optional(),
  status: tableStatusEnum.optional(),
  zoneId: z.string().uuid().optional(),
});

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  tableNumber: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(20),
  minPartySize: z.number().int().min(1).default(1),
  maxPartySize: z.number().int().min(1).max(20).optional().nullable(),
  category: tableCategoryEnum.default("dining"),
  seatingType: tableSeatingEnum.default("standard"),
  mobility: tableMobilityEnum.default("movable"),
  zoneId: z.string().uuid(),
  active: z.boolean().default(true),
  section: z.string().max(100).optional().nullable(),
  status: tableStatusEnum.default("available"),
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const paramEntries = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(paramEntries);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    const { restaurantId, section, status, zoneId } = parsed.data;

    const filters = {
      section: section && section.trim().length > 0 ? section : undefined,
      status,
      zoneId,
    } as const;

    const { tables, summary } = await listTablesWithSummary(supabase, restaurantId, filters);

    return NextResponse.json({
      tables,
      summary,
    });
  } catch (error) {
    console.error("[ops/tables][GET] Unexpected error", { error });
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// =====================================================
// POST /api/ops/tables - Create table
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createTableSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", data.restaurantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json({ error: "Access denied to this restaurant" }, { status: 403 });
    }

    const maxPartySize = data.maxPartySize ?? null;
    if (maxPartySize !== null && maxPartySize < data.minPartySize) {
      return NextResponse.json({ error: "maxPartySize must be >= minPartySize" }, { status: 400 });
    }

    const { data: zone, error: zoneError } = await supabase
      .from("zones")
      .select("id, restaurant_id")
      .eq("id", data.zoneId)
      .maybeSingle();

    if (zoneError || !zone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }

    if (zone.restaurant_id !== data.restaurantId) {
      return NextResponse.json(
        { error: "Zone belongs to a different restaurant" },
        { status: 400 },
      );
    }

    try {
      const existing = await findTableByNumber(supabase, data.restaurantId, data.tableNumber.trim());
      if (existing) {
        return NextResponse.json(
          { error: `Table number "${data.tableNumber}" already exists` },
          { status: 409 },
        );
      }
    } catch (lookupError) {
      console.error("[ops/tables][POST] Duplicate check failed", { error: lookupError });
      return NextResponse.json({ error: "Failed to verify table uniqueness" }, { status: 500 });
    }

    try {
      await ensureAllowedCapacity(supabase, data.restaurantId, data.capacity);
    } catch (capacityError) {
      console.error("[ops/tables][POST] Capacity ensure failed", { error: capacityError });
      return NextResponse.json({ error: "Failed to prepare capacity configuration" }, { status: 500 });
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
    } satisfies TablesInsert<"table_inventory">;

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
        typeof createError === "object" && createError && "code" in createError
          ? (createError as { code?: string }).code
          : undefined;

      if (errorCode === "23503") {
        return NextResponse.json(
          { error: "Capacity is not configured for this restaurant" },
          { status: 422 },
        );
      }

      console.error("[ops/tables][POST] Create error", { error: createError });
      return NextResponse.json({ error: "Failed to create table" }, { status: 500 });
    }
  } catch (error) {
    console.error("[ops/tables][POST] Unexpected error", { error });
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
