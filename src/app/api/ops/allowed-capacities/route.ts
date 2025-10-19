import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { isCapacityConfigEnabled } from "@/server/feature-flags";

const querySchema = z.object({
  restaurantId: z.string().uuid(),
});

const updateSchema = z.object({
  restaurantId: z.string().uuid(),
  capacities: z
    .array(z.number().int().min(1).max(20))
    .min(1, "At least one capacity is required")
    .max(12, "Too many capacity entries")
    .refine((values) => new Set(values).size === values.length, {
      message: "Capacities must be unique",
    }),
});

type RouteSupabaseClient = Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;

async function ensureFeatureEnabled(): Promise<NextResponse | null> {
  if (!isCapacityConfigEnabled()) {
    return NextResponse.json({ error: "Capacity configuration feature is disabled" }, { status: 404 });
  }
  return null;
}

async function fetchAllowedCapacities(client: RouteSupabaseClient, restaurantId: string): Promise<number[]> {
  const { data, error } = await client
    .from("allowed_capacities")
    .select("capacity")
    .eq("restaurant_id", restaurantId)
    .order("capacity", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => Number(row.capacity)).filter((value) => Number.isFinite(value));
}

export async function GET(req: NextRequest) {
  const featureCheck = await ensureFeatureEnabled();
  if (featureCheck) {
    return featureCheck;
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(searchParams);

  if (!parsed.success) {
    return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });
  }

  const { restaurantId } = parsed.data;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const capacities = await fetchAllowedCapacities(supabase, restaurantId);
    return NextResponse.json({ capacities });
  } catch (error) {
    console.error("[ops/allowed-capacities][GET] Failed to load", { error, restaurantId });
    return NextResponse.json({ error: "Failed to load allowed capacities" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const featureCheck = await ensureFeatureEnabled();
  if (featureCheck) {
    return featureCheck;
  }

  const supabase = await getRouteHandlerSupabaseClient();

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { restaurantId, capacities } = parsed.data;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const existing = await fetchAllowedCapacities(supabase, restaurantId);
    const existingSet = new Set(existing);
    const requestedSet = new Set(capacities);

    const toInsert = capacities.filter((value) => !existingSet.has(value));
    const toDelete = existing.filter((value) => !requestedSet.has(value));

    if (toInsert.length > 0) {
      const insertPayload = toInsert.map((value) => ({ restaurant_id: restaurantId, capacity: value }));
      const { error: insertError } = await supabase.from("allowed_capacities").upsert(insertPayload, {
        onConflict: "restaurant_id,capacity",
        ignoreDuplicates: true,
      });
      if (insertError) {
        throw insertError;
      }
    }

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("allowed_capacities")
        .delete()
        .eq("restaurant_id", restaurantId)
        .in("capacity", toDelete);

      if (deleteError) {
        if (deleteError.code === "23503") {
          return NextResponse.json(
            {
              error: "Cannot remove capacity while tables still use it",
              blockedCapacities: toDelete,
            },
            { status: 409 },
          );
        }
        throw deleteError;
      }
    }

    const finalCapacities = await fetchAllowedCapacities(supabase, restaurantId);
    return NextResponse.json({ capacities: finalCapacities });
  } catch (error) {
    console.error("[ops/allowed-capacities][PUT] Failed to update", { error, restaurantId, capacities });
    return NextResponse.json({ error: "Failed to update allowed capacities" }, { status: 500 });
  }
}
