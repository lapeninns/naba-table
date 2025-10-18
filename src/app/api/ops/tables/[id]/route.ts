/**
 * Table Inventory Management API - Single Table
 * Story 4: Ops Dashboard - Table CRUD (Update, Delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

// =====================================================
// Request Validation
// =====================================================

const CAPACITY_OPTIONS = [2, 4, 5, 7] as const;

const isoDateTimeString = z.string().refine((value) => {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}, { message: "Invalid ISO datetime" });

const maintenanceSchema = z
  .object({
    startIso: isoDateTimeString,
    endIso: isoDateTimeString,
    reason: z.string().max(200).optional().nullable(),
  })
  .refine((value) => new Date(value.endIso).getTime() > new Date(value.startIso).getTime(), {
    message: "endIso must be after startIso",
  });

const updateTableSchema = z.object({
  tableNumber: z.string().min(1).max(50).optional(),
  capacity: z
    .number()
    .int()
    .refine((value) => CAPACITY_OPTIONS.includes(value as (typeof CAPACITY_OPTIONS)[number]), {
      message: "capacity must be one of 2, 4, 5, or 7",
    })
    .optional(),
  minPartySize: z.number().int().min(1).optional(),
  maxPartySize: z.number().int().min(1).max(20).optional().nullable(),
  category: z.enum(["bar", "dining", "lounge", "patio", "private"]).optional(),
  seatingType: z.enum(["standard", "sofa", "booth", "high_top"]).optional(),
  mobility: z.enum(["movable", "fixed"]).optional(),
  zoneId: z.string().uuid().optional(),
  active: z.boolean().optional(),
  section: z.string().max(100).optional().nullable(),
  status: z.enum(["available", "reserved", "occupied", "out_of_service"]).optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
      rotation: z.number().optional(),
    })
    .optional()
    .nullable(),
  notes: z.string().max(500).optional().nullable(),
  maintenance: maintenanceSchema.optional(),
});

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
      .select("restaurant_id, zone_id, min_party_size, max_party_size, status")
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
    const maintenance = updates.maintenance ?? null;

    let maintenanceRange: string | null = null;
    if (updates.status === "out_of_service") {
      if (!maintenance) {
        return NextResponse.json({ error: "Maintenance window is required when setting out_of_service" }, { status: 400 });
      }

      const startIso = new Date(maintenance.startIso).toISOString();
      const endIso = new Date(maintenance.endIso).toISOString();
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        return NextResponse.json({ error: "Maintenance end must be after start" }, { status: 400 });
      }

      maintenanceRange = `[${startIso},${endIso})`;
    }

    const effectiveMinPartySize = updates.minPartySize ?? table.min_party_size ?? 1;
    const effectiveMaxPartySize = updates.maxPartySize ?? table.max_party_size ?? null;

    if (typeof effectiveMaxPartySize === "number" && effectiveMaxPartySize < effectiveMinPartySize) {
      return NextResponse.json(
        { error: "maxPartySize must be >= minPartySize" },
        { status: 400 }
      );
    }

    if (updates.zoneId) {
      const { data: zone, error: zoneError } = await supabase
        .from("zones")
        .select("id, restaurant_id")
        .eq("id", updates.zoneId)
        .maybeSingle();

      if (zoneError || !zone) {
        return NextResponse.json(
          { error: "Zone not found" },
          { status: 404 }
        );
      }

      if (zone.restaurant_id !== table.restaurant_id) {
        return NextResponse.json(
          { error: "Zone belongs to a different restaurant" },
          { status: 400 }
        );
      }
    }

    const updatePayload: Record<string, unknown> = {};

    if (updates.tableNumber !== undefined) updatePayload.table_number = updates.tableNumber;
    if (updates.capacity !== undefined) updatePayload.capacity = updates.capacity;
    if (updates.minPartySize !== undefined) updatePayload.min_party_size = updates.minPartySize;
    if (updates.maxPartySize !== undefined) updatePayload.max_party_size = updates.maxPartySize;
    if (updates.section !== undefined) updatePayload.section = updates.section;
    if (updates.category !== undefined) updatePayload.category = updates.category;
    if (updates.seatingType !== undefined) updatePayload.seating_type = updates.seatingType;
    if (updates.mobility !== undefined) updatePayload.mobility = updates.mobility;
    if (updates.zoneId !== undefined) updatePayload.zone_id = updates.zoneId;
    if (updates.active !== undefined) updatePayload.active = updates.active;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.position !== undefined) updatePayload.position = updates.position;
    if (updates.notes !== undefined) updatePayload.notes = updates.notes;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ message: "No changes supplied" });
    }

    const { data: updatedTable, error: updateError } = await supabase
      .from("table_inventory")
      .update(updatePayload)
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

    const serviceClient = getServiceSupabaseClient();

    if (updates.status === "out_of_service" && maintenanceRange) {
      const removeExisting = await serviceClient
        .from("allocations")
        .delete()
        .eq("resource_type", "table")
        .eq("resource_id", tableId)
        .eq("is_maintenance", true);

      if (removeExisting.error) {
        console.error("[ops/tables/[id]][PATCH] Failed to reset maintenance allocation", removeExisting.error);
        return NextResponse.json({ error: "Failed to schedule maintenance" }, { status: 500 });
      }

      const maintenanceInsert = await serviceClient
        .from("allocations")
        .insert({
          booking_id: null,
          restaurant_id: table.restaurant_id,
          resource_type: "table",
          resource_id: tableId,
          window: maintenanceRange,
          created_by: user.id,
          shadow: false,
          is_maintenance: true,
        });

      if (maintenanceInsert.error) {
        console.error("[ops/tables/[id]][PATCH] Failed to create maintenance allocation", maintenanceInsert.error);
        // Attempt to revert status change if possible
        if (updates.status !== table.status) {
          await supabase
            .from("table_inventory")
            .update({ status: table.status })
            .eq("id", tableId);
        }
        return NextResponse.json({ error: "Failed to schedule maintenance" }, { status: 500 });
      }
    } else if (typeof updates.status === "string" && updates.status !== "out_of_service") {
      const removeExisting = await serviceClient
        .from("allocations")
        .delete()
        .eq("resource_type", "table")
        .eq("resource_id", tableId)
        .eq("is_maintenance", true);

      if (removeExisting.error) {
        console.error("[ops/tables/[id]][PATCH] Failed to clear maintenance allocation", removeExisting.error);
        if (updates.status !== table.status) {
          await supabase
            .from("table_inventory")
            .update({ status: table.status })
            .eq("id", tableId);
        }
        return NextResponse.json({ error: "Failed to clear maintenance window" }, { status: 500 });
      }
    }

    return NextResponse.json({
      table: {
        ...updatedTable,
        merge_eligible: mergeEligible({
          category: updatedTable.category,
          seating_type: updatedTable.seating_type,
          mobility: updatedTable.mobility,
          capacity: updatedTable.capacity,
        }),
      },
    });
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
