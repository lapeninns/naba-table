/**
 * Table Inventory Management API - Single Table
 * Story 4: Ops Dashboard - Table CRUD (Update, Delete)
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureAllowedCapacity, fetchTableById, updateTable as updateTableRecord, deleteTable as deleteTableRecord } from "@/server/ops/tables";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { TablesUpdate } from "@/types/supabase";
import type { NextRequest} from "next/server";

const tableStatusEnum = z.enum(["available", "reserved", "occupied", "out_of_service"]);
const tableCategoryEnum = z.enum(["bar", "dining", "lounge", "patio", "private"]);
const tableSeatingEnum = z.enum(["standard", "sofa", "booth", "high_top"]);
const tableMobilityEnum = z.enum(["movable", "fixed"]);

const isoDateTimeString = z
  .string()
  .refine((value) => typeof value === "string" && !Number.isNaN(Date.parse(value)), {
    message: "Invalid ISO datetime",
  });

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
      x: z.number(),
      y: z.number(),
      rotation: z.number().optional(),
    })
    .optional()
    .nullable(),
  notes: z.string().max(500).optional().nullable(),
  maintenance: maintenanceSchema.optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

function coerceNullableString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// =====================================================
// PATCH /api/ops/tables/[id] - Update table
// =====================================================

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tableId } = await context.params;
    const existingTable = await fetchTableById(supabase, tableId);

    if (!existingTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", existingTable.restaurant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json({ error: "Access denied to this restaurant" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateTableSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updates = parsed.data;
    const maintenanceRange = updates.maintenance
      ? {
          start: new Date(updates.maintenance.startIso).toISOString(),
          end: new Date(updates.maintenance.endIso).toISOString(),
          reason: updates.maintenance.reason ?? null,
        }
      : null;

    if (updates.zoneId && updates.zoneId !== existingTable.zone_id) {
      const { data: zone, error: zoneError } = await supabase
        .from("zones")
        .select("id, restaurant_id")
        .eq("id", updates.zoneId)
        .maybeSingle();

      if (zoneError || !zone) {
        return NextResponse.json({ error: "Zone not found" }, { status: 404 });
      }

      if (zone.restaurant_id !== existingTable.restaurant_id) {
        return NextResponse.json({ error: "Zone belongs to a different restaurant" }, { status: 400 });
      }
    }

    const desiredMinPartySize = updates.minPartySize ?? existingTable.min_party_size;
    const desiredMaxPartySize =
      updates.maxPartySize !== undefined ? updates.maxPartySize : existingTable.max_party_size;

    if (desiredMaxPartySize !== null && desiredMaxPartySize < desiredMinPartySize) {
      return NextResponse.json({ error: "maxPartySize must be >= minPartySize" }, { status: 400 });
    }


    const updatePayload: TablesUpdate<"table_inventory"> = {};

    if (updates.tableNumber !== undefined) {
      updatePayload.table_number = updates.tableNumber.trim();
    }
    if (updates.capacity !== undefined) {
      updatePayload.capacity = updates.capacity;
    }
    if (updates.minPartySize !== undefined) {
      updatePayload.min_party_size = updates.minPartySize;
    }
    if (updates.maxPartySize !== undefined) {
      updatePayload.max_party_size = updates.maxPartySize;
    }
    if (updates.section !== undefined) {
      updatePayload.section = coerceNullableString(updates.section);
    }
    if (updates.category !== undefined) {
      updatePayload.category = updates.category;
    }
    if (updates.seatingType !== undefined) {
      updatePayload.seating_type = updates.seatingType;
    }
    if (updates.mobility !== undefined) {
      updatePayload.mobility = updates.mobility;
    }
    if (updates.zoneId !== undefined) {
      updatePayload.zone_id = updates.zoneId;
    }
    if (updates.active !== undefined) {
      updatePayload.active = updates.active;
    }
    if (updates.status !== undefined) {
      updatePayload.status = updates.status;
    }
    if (updates.position !== undefined) {
      updatePayload.position = updates.position ?? null;
    }
    if (updates.notes !== undefined) {
      updatePayload.notes = coerceNullableString(updates.notes);
    }

    if (Object.keys(updatePayload).length === 0 && !maintenanceRange) {
      return NextResponse.json({ message: "No changes supplied" });
    }

    try {
      if (updates.capacity !== undefined && updates.capacity !== existingTable.capacity) {
        await ensureAllowedCapacity(supabase, existingTable.restaurant_id, updates.capacity);
      }
    } catch (capacityError) {
      console.error("[ops/tables/[id]][PATCH] Capacity ensure failed", { error: capacityError, tableId });
      return NextResponse.json({ error: "Failed to prepare capacity configuration" }, { status: 500 });
    }

    let updatedTable;
    try {
      updatedTable = Object.keys(updatePayload).length
        ? await updateTableRecord(supabase, tableId, updatePayload)
        : await fetchTableById(supabase, tableId);
    } catch (updateError) {
      const errorCode =
        typeof updateError === "object" && updateError && "code" in updateError
          ? (updateError as { code?: string }).code
          : undefined;

      if (errorCode === "23503") {
        return NextResponse.json(
          { error: "Capacity is not configured for this restaurant" },
          { status: 422 },
        );
      }

      console.error("[ops/tables/[id]][PATCH] Update error", { error: updateError });
      return NextResponse.json({ error: "Failed to update table" }, { status: 500 });
    }

    if (!updatedTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
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

      const maintenanceInsert = await serviceClient.from("allocations").insert({
        booking_id: null,
        restaurant_id: existingTable.restaurant_id,
        resource_type: "table",
        resource_id: tableId,
        window: maintenanceRange,
        created_by: user.id,
        shadow: false,
        is_maintenance: true,
      });

      if (maintenanceInsert.error) {
        console.error("[ops/tables/[id]][PATCH] Failed to create maintenance allocation", maintenanceInsert.error);
        if (updates.status !== existingTable.status) {
          await supabase
            .from("table_inventory")
            .update({ status: existingTable.status })
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
        if (updates.status !== existingTable.status) {
          await supabase
            .from("table_inventory")
            .update({ status: existingTable.status })
            .eq("id", tableId);
        }
        return NextResponse.json({ error: "Failed to clear maintenance window" }, { status: 500 });
      }
    }

    return NextResponse.json({
      table: {
        ...updatedTable,
      },
    });
  } catch (error) {
    console.error("[ops/tables/[id]][PATCH] Unexpected error", { error });
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// =====================================================
// DELETE /api/ops/tables/[id] - Delete table
// =====================================================

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tableId } = await context.params;
    const table = await fetchTableById(supabase, tableId);

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", table.restaurant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json({ error: "Access denied to this restaurant" }, { status: 403 });
    }

    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can delete tables" },
        { status: 403 },
      );
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    const { data: futureAssignments, error: futureError } = await supabase
      .from("booking_table_assignments")
      .select("id, bookings!inner(booking_date)")
      .eq("table_id", tableId)
      .gte("bookings.booking_date", tomorrowDate ?? "")
      .limit(1);

    if (futureError) {
      console.error("[ops/tables/[id]][DELETE] Future assignment lookup failed", { error: futureError });
      return NextResponse.json({ error: "Failed to verify future assignments" }, { status: 500 });
    }

    if (futureAssignments && futureAssignments.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete table with future booking assignments",
          message: "Please reassign or cancel future bookings first",
        },
        { status: 409 },
      );
    }

    try {
      await deleteTableRecord(supabase, tableId);
    } catch (deleteError) {
      console.error("[ops/tables/[id]][DELETE] Delete error", { error: deleteError });
      return NextResponse.json({ error: "Failed to delete table" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedTableNumber: table.table_number });
  } catch (error) {
    console.error("[ops/tables/[id]][DELETE] Unexpected error", { error });
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
