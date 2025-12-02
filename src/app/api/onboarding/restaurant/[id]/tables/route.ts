import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureAllowedCapacity } from "@/server/ops/tables";
import { validateCsrfToken } from "@/server/security/csrf";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireAdminMembership } from "@/server/team/access";

import type { NextRequest } from "next/server";

const categoryEnum = z.enum(["dining", "bar", "lounge", "patio", "private"]);
const seatingTypeEnum = z.enum(["standard", "sofa", "booth", "high_top"]);
const mobilityEnum = z.enum(["movable", "fixed"]);
const statusEnum = z.enum(["available", "reserved", "occupied", "out_of_service"]);

const tableSchema = z
  .object({
    id: z.string().uuid().optional(),
    tableNumber: z.string().min(1).max(64),
    capacity: z.number().int().min(1).max(50),
    minPartySize: z.number().int().min(1).max(50).default(1),
    maxPartySize: z.number().int().min(1).max(50).nullable().optional(),
    section: z.string().max(80).nullable().optional(),
    category: categoryEnum,
    seatingType: seatingTypeEnum,
    mobility: mobilityEnum.default("movable"),
    zoneId: z.string().uuid(),
    status: statusEnum.default("available"),
    active: z.boolean().optional(),
    position: z.record(z.string(), z.any()).nullable().optional(),
    notes: z.string().max(240).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.maxPartySize !== undefined && data.maxPartySize !== null && data.maxPartySize < data.minPartySize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxPartySize must be >= minPartySize",
        path: ["maxPartySize"],
      });
    }
    if (data.minPartySize > data.capacity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minPartySize cannot exceed capacity",
        path: ["minPartySize"],
      });
    }
    if (data.maxPartySize !== undefined && data.maxPartySize !== null && data.maxPartySize > data.capacity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxPartySize cannot exceed capacity",
        path: ["maxPartySize"],
      });
    }
  });

const payloadSchema = z.object({
  tables: z.array(tableSchema).min(1, "At least one table is required"),
});

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

async function resolveRestaurantId(paramsPromise: Promise<{ id: string | string[] }> | undefined): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === "string") return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

function handleUnexpectedError(error: unknown, context: string) {
  console.error(context, error);
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: "Missing restaurant id" }, { status: 400 });
  }

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
    }
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    await requireAdminMembership({
      userId: user.id,
      restaurantId,
      client: supabase,
    });

    const serviceClient = getServiceSupabaseClient();
    const { data, error } = await serviceClient
      .from("table_inventory")
      .select("id, table_number, capacity, min_party_size, max_party_size, category, seating_type, mobility, zone_id, status, active")
      .eq("restaurant_id", restaurantId)
      .order("table_number", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ tables: data ?? [] }, { status: 200 });
  } catch (error) {
    return handleUnexpectedError(error, "[onboarding][restaurant][tables][GET]");
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 });
  }
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: "Missing restaurant id" }, { status: 400 });
  }

  let tables: z.infer<typeof tableSchema>[];
  try {
    const json = await req.json();
    tables = payloadSchema.parse(json).tables;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
    }
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    await requireAdminMembership({
      userId: user.id,
      restaurantId,
      client: supabase,
    });

    const serviceClient = getServiceSupabaseClient();

    // Ensure FK target exists before inserting tables
    const capacities = Array.from(new Set(tables.map((table) => table.capacity).filter((value) => Number.isFinite(value))));
    await Promise.all(capacities.map((capacity) => ensureAllowedCapacity(serviceClient, restaurantId, capacity)));

    const rows = tables.map((table) => ({
      id: table.id,
      restaurant_id: restaurantId,
      table_number: table.tableNumber.trim(),
      capacity: table.capacity,
      min_party_size: table.minPartySize,
      max_party_size: table.maxPartySize ?? null,
      section: table.section ?? null,
      status: table.status,
      position: table.position ?? null,
      notes: table.notes ?? null,
      zone_id: table.zoneId,
      category: table.category,
      seating_type: table.seatingType,
      mobility: table.mobility,
      active: table.active ?? true,
    }));

    const { error: upsertError } = await serviceClient
      .from("table_inventory")
      .upsert(rows, { onConflict: "id" });
    if (upsertError) {
      throw upsertError;
    }

    const { data: refreshed, error: refreshError } = await serviceClient
      .from("table_inventory")
      .select("id, table_number, capacity, min_party_size, max_party_size, category, seating_type, mobility, zone_id, status, active")
      .eq("restaurant_id", restaurantId)
      .order("table_number", { ascending: true });
    if (refreshError) {
      throw refreshError;
    }

    return NextResponse.json({ tables: refreshed ?? [] }, { status: 200 });
  } catch (error) {
    return handleUnexpectedError(error, "[onboarding][restaurant][tables][POST]");
  }
}
