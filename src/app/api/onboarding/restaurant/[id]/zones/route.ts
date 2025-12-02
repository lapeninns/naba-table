import { NextResponse } from "next/server";
import { z } from "zod";

import { listZones } from "@/server/ops/zones";
import { validateCsrfToken } from "@/server/security/csrf";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireAdminMembership } from "@/server/team/access";

import type { NextRequest } from "next/server";

const zoneSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  areaType: z.enum(["indoor", "outdoor"]).optional().default("indoor"),
  sortOrder: z.number().int().min(0).max(500).optional(),
  active: z.boolean().optional(),
});

const payloadSchema = z.object({
  zones: z.array(zoneSchema).min(1, "At least one zone is required"),
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
    const zones = await listZones(serviceClient, restaurantId);
    return NextResponse.json({ zones }, { status: 200 });
  } catch (error) {
    return handleUnexpectedError(error, "[onboarding][restaurant][zones][GET]");
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

  let zones: z.infer<typeof zoneSchema>[];
  try {
    const json = await req.json();
    zones = payloadSchema.parse(json).zones;
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

    // Keep it simple: upsert provided zones

    const rows = zones.map((zone) => ({
      id: zone.id,
      restaurant_id: restaurantId,
      name: zone.name.trim(),
      sort_order: zone.sortOrder ?? 0,
      active: zone.active ?? true,
      area_type: zone.areaType ?? 'indoor',
    }));

    const { error: upsertError } = await serviceClient
      .from("zones")
      .upsert(rows, { onConflict: "id" });
    if (upsertError) {
      throw upsertError;
    }

    const refreshed = await listZones(serviceClient, restaurantId);
    return NextResponse.json({ zones: refreshed }, { status: 200 });
  } catch (error) {
    return handleUnexpectedError(error, "[onboarding][restaurant][zones][POST]");
  }
}
