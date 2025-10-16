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
  section: z.string().max(100).optional().nullable(),
  seatingType: z.enum(["indoor", "outdoor", "bar", "patio", "private_room"]).default("indoor"),
  status: z.enum(["available", "reserved", "occupied", "out_of_service"]).default("available"),
  position: z.object({
    x: z.number(),
    y: z.number(),
    rotation: z.number().optional(),
  }).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

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

    // Build query
    let query = supabase
      .from("table_inventory")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("table_number", { ascending: true });

    if (section) {
      query = query.eq("section", section);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: tables, error } = await query;

    if (error) {
      console.error("[ops/tables][GET] Database error", { error });
      return NextResponse.json(
        { error: "Failed to fetch tables" },
        { status: 500 }
      );
    }

    // Get summary stats
    const totalTables = tables?.length ?? 0;
    const totalCapacity = tables?.reduce((sum, t) => sum + t.capacity, 0) ?? 0;
    const availableTables = tables?.filter(t => t.status === "available").length ?? 0;

    return NextResponse.json({
      tables: tables ?? [],
      summary: {
        totalTables,
        totalCapacity,
        availableTables,
        sections: [...new Set(tables?.map(t => t.section).filter(Boolean))],
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
        seating_type: data.seatingType,
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

    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    console.error("[ops/tables][POST] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
