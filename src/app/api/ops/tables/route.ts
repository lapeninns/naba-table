/**
 * Table Inventory Management API
 * Story 4: Ops Dashboard - Tables CRUD
 * 
 * Endpoints:
 * - GET /api/ops/tables - List all tables for a restaurant
 * - POST /api/ops/tables - Create new table
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

// =====================================================
// Request Validation
// =====================================================

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  tableNumber: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(20),
  minPartySize: z.number().int().min(1).default(1),
  maxPartySize: z.number().int().min(1).max(20).optional().nullable(),
  category: z.enum(["bar", "dining", "lounge", "patio", "private"]).default("dining"),
  seatingType: z.enum(["standard", "sofa", "booth", "high_top"]).default("standard"),
  mobility: z.enum(["movable", "fixed"]).default("movable"),
  zoneId: z.string().uuid(),
  active: z.boolean().default(true),
  section: z.string().max(100).optional().nullable(),
  status: z.enum(["available", "reserved", "occupied", "out_of_service"]).default("available"),
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

type RouteSupabaseClient = Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;

async function loadAllowedCapacities(client: RouteSupabaseClient, restaurantId: string): Promise<number[]> {
  const { data, error } = await client
    .from("allowed_capacities")
    .select("capacity")
    .eq("restaurant_id", restaurantId);

  if (error) {
    throw new Error(`Failed to load allowed capacities: ${error.message}`);
  }

  return (data ?? []).map((row) => Number(row.capacity)).filter((value) => Number.isFinite(value));
}

const mergeEligible = (input: {
  category: string | null | undefined;
  seating_type: string | null | undefined;
  mobility: string | null | undefined;
  capacity: number | null | undefined;
}): boolean => {
  if (!input) {
    return false;
  }

  return (
    input.category === "dining" &&
    input.seating_type === "standard" &&
    input.mobility === "movable" &&
    (input.capacity === 2 || input.capacity === 4)
  );
};

// =====================================================
// GET /api/ops/tables - List tables
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const restaurantId = searchParams.get("restaurantId");
    const section = searchParams.get("section");
    const status = searchParams.get("status");

    if (!restaurantId) {
      return NextResponse.json(
        { error: "restaurantId query parameter is required" },
        { status: 400 }
      );
    }

    let tablesQuery = supabase
      .from("table_inventory")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("table_number", { ascending: true });

    if (section) {
      tablesQuery = tablesQuery.eq("section", section);
    }

    if (status) {
      tablesQuery = tablesQuery.eq("status", status);
    }

    const [tablesResult, zonesResult] = await Promise.all([
      tablesQuery,
      supabase
        .from("zones")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (tablesResult.error) {
      console.error("[ops/tables][GET] Database error", { error: tablesResult.error });
      return NextResponse.json(
        { error: "Failed to fetch tables" },
        { status: 500 }
      );
    }

    if (zonesResult.error) {
      console.error("[ops/tables][GET] Zones error", { error: zonesResult.error });
      return NextResponse.json(
        { error: "Failed to fetch zones" },
        { status: 500 }
      );
    }

    const tables = tablesResult.data ?? [];
    const zones = zonesResult.data ?? [];
    const zoneMap = new Map(zones.map((zone) => [zone.id, zone.name] as const));

    const tablesWithMetadata = tables.map((table) => ({
      ...table,
      merge_eligible: mergeEligible({
        category: table.category,
        seating_type: table.seating_type,
        mobility: table.mobility,
        capacity: table.capacity,
      }),
      zone: zoneMap.has(table.zone_id)
        ? { id: table.zone_id, name: zoneMap.get(table.zone_id)! }
        : null,
    }));

    const totalTables = tablesWithMetadata.length;
    const totalCapacity = tablesWithMetadata.reduce((sum, t) => sum + (t.capacity ?? 0), 0);
    const availableTables = tablesWithMetadata.filter((t) => t.status === "available").length;

    return NextResponse.json({
      tables: tablesWithMetadata,
      summary: {
        totalTables,
        totalCapacity,
        availableTables,
        zones: zones.map((zone) => ({ id: zone.id, name: zone.name })),
      },
    });
  } catch (error) {
    console.error("[ops/tables][GET] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/ops/tables - Create table
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = createTableSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify user has access to this restaurant
    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", data.restaurantId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Access denied to this restaurant" },
        { status: 403 }
      );
    }

    // Validate maxPartySize >= minPartySize
    if (data.maxPartySize && data.maxPartySize < data.minPartySize) {
      return NextResponse.json(
        { error: "maxPartySize must be >= minPartySize" },
        { status: 400 }
      );
    }

    // Confirm zone belongs to restaurant
    const { data: zone, error: zoneError } = await supabase
      .from("zones")
      .select("id, restaurant_id")
      .eq("id", data.zoneId)
      .maybeSingle();

    if (zoneError || !zone) {
      return NextResponse.json(
        { error: "Zone not found" },
        { status: 404 }
      );
    }

    if (zone.restaurant_id !== data.restaurantId) {
      return NextResponse.json(
        { error: "Zone belongs to a different restaurant" },
        { status: 400 }
      );
    }

    let allowedCapacities: number[] = [];
    try {
      allowedCapacities = await loadAllowedCapacities(supabase, data.restaurantId);
    } catch (error) {
      console.error("[ops/tables][POST] Allowed capacities lookup failed", { error, restaurantId: data.restaurantId });
      return NextResponse.json(
        { error: "Unable to verify allowed capacities for this restaurant" },
        { status: 500 },
      );
    }

    if (allowedCapacities.length === 0) {
      return NextResponse.json(
        { error: "No allowed capacities configured for this restaurant" },
        { status: 422 },
      );
    }

    if (!allowedCapacities.includes(data.capacity)) {
      return NextResponse.json(
        {
          error: `Capacity ${data.capacity} is not permitted for this restaurant`,
          allowed: allowedCapacities,
        },
        { status: 422 },
      );
    }

    // Check for duplicate table number
    const { data: existing } = await supabase
      .from("table_inventory")
      .select("id")
      .eq("restaurant_id", data.restaurantId)
      .eq("table_number", data.tableNumber)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Table number "${data.tableNumber}" already exists` },
        { status: 409 }
      );
    }

    // Create table
    const { data: table, error: createError } = await supabase
      .from("table_inventory")
      .insert({
        restaurant_id: data.restaurantId,
        table_number: data.tableNumber,
        capacity: data.capacity,
        min_party_size: data.minPartySize,
        max_party_size: data.maxPartySize,
        section: data.section,
        category: data.category,
        seating_type: data.seatingType,
        mobility: data.mobility,
        zone_id: data.zoneId,
        active: data.active,
        status: data.status,
        position: data.position,
        notes: data.notes,
      })
      .select()
      .single();

    if (createError) {
      console.error("[ops/tables][POST] Create error", { error: createError });
      return NextResponse.json(
        { error: "Failed to create table" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      table: {
        ...table,
        merge_eligible: mergeEligible({
          category: table.category,
          seating_type: table.seating_type,
          mobility: table.mobility,
          capacity: table.capacity,
        }),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[ops/tables][POST] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
