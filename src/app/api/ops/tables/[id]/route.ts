/**
 * Table Inventory Management API - Single Table
 * Story 4: Ops Dashboard - Table CRUD (Update, Delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

// =====================================================
// Request Validation
// =====================================================

const updateTableSchema = z.object({
  tableNumber: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(20).optional(),
  minPartySize: z.number().int().min(1).optional(),
  maxPartySize: z.number().int().min(1).max(20).optional().nullable(),
  section: z.string().max(100).optional().nullable(),
  seatingType: z.enum(["indoor", "outdoor", "bar", "patio", "private_room"]).optional(),
  status: z.enum(["available", "reserved", "occupied", "out_of_service"]).optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    rotation: z.number().optional(),
  }).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};
// =====================================================
// PATCH /api/ops/tables/[id] - Update table
// =====================================================

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tableId } = await context.params;

    // Get table to verify access
    const { data: table, error: fetchError } = await supabase
      .from("table_inventory")
      .select("restaurant_id")
      .eq("id", tableId)
      .single();

    if (fetchError || !table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Verify user has access
    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", table.restaurant_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Access denied to this restaurant" },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = updateTableSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updates = parsed.data;

    // Update table
    const { data: updatedTable, error: updateError } = await supabase
      .from("table_inventory")
      .update({
        table_number: updates.tableNumber,
        capacity: updates.capacity,
        min_party_size: updates.minPartySize,
        max_party_size: updates.maxPartySize,
        section: updates.section,
        seating_type: updates.seatingType,
        status: updates.status,
        position: updates.position,
        notes: updates.notes,
      })
      .eq("id", tableId)
      .select()
      .single();

    if (updateError) {
      console.error("[ops/tables/[id]][PATCH] Update error", { error: updateError });
      return NextResponse.json(
        { error: "Failed to update table" },
        { status: 500 }
      );
    }

    return NextResponse.json({ table: updatedTable });
  } catch (error) {
    console.error("[ops/tables/[id]][PATCH] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/ops/tables/[id] - Delete table
// =====================================================

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tableId } = await context.params;

    // Get table to verify access
    const { data: table, error: fetchError } = await supabase
      .from("table_inventory")
      .select("restaurant_id, table_number")
      .eq("id", tableId)
      .single();

    if (fetchError || !table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Verify user has admin/owner role
    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", table.restaurant_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Access denied to this restaurant" },
        { status: 403 }
      );
    }

    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can delete tables" },
        { status: 403 }
      );
    }

    // Check if table has future assignments
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    const { data: futureAssignments } = await supabase
      .from("booking_table_assignments")
      .select("id, bookings!inner(booking_date)")
      .eq("table_id", tableId)
      .gte("bookings.booking_date", tomorrowDate!)
      .limit(1);

    if (futureAssignments && futureAssignments.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete table with future booking assignments",
          message: "Please reassign or cancel future bookings first",
        },
        { status: 409 }
      );
    }

    // Delete table
    const { error: deleteError } = await supabase
      .from("table_inventory")
      .delete()
      .eq("id", tableId);

    if (deleteError) {
      console.error("[ops/tables/[id]][DELETE] Delete error", { error: deleteError });
      return NextResponse.json(
        { error: "Failed to delete table" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedTableNumber: table.table_number });
  } catch (error) {
    console.error("[ops/tables/[id]][DELETE] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
