import { NextResponse } from "next/server";
import { z } from "zod";

import { validateCsrfToken } from "@/server/security/csrf";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireAdminMembership } from "@/server/team/access";

import type { NextRequest } from "next/server";

const payloadSchema = z.object({
  allowedCapacities: z.array(z.number().int().min(1).max(20)).optional(),
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

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 });
  }
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: "Missing restaurant id" }, { status: 400 });
  }

  let allowedCapacities: number[] | undefined;
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = payloadSchema.parse(json);
    allowedCapacities = parsed.allowedCapacities;
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

    if (allowedCapacities && allowedCapacities.length > 0) {
      const unique = Array.from(new Set(allowedCapacities)).sort((a, b) => a - b);
      const existing = await serviceClient
        .from("allowed_capacities")
        .select("capacity")
        .eq("restaurant_id", restaurantId);
      if (existing.error) throw existing.error;
      const existingSet = new Set((existing.data ?? []).map((row) => Number(row.capacity)));

      const toInsert = unique.filter((value) => !existingSet.has(value));
      const toDelete = (existing.data ?? [])
        .map((row) => Number(row.capacity))
        .filter((value) => !unique.includes(value));

      if (toInsert.length > 0) {
        const { error } = await serviceClient
          .from("allowed_capacities")
          .insert(toInsert.map((cap) => ({ restaurant_id: restaurantId, capacity: cap })));
        if (error) throw error;
      }

      if (toDelete.length > 0) {
        const { error } = await serviceClient
          .from("allowed_capacities")
          .delete()
          .eq("restaurant_id", restaurantId)
          .in("capacity", toDelete);
        if (error) throw error;
      }
    }

    // Mark restaurant active (noop if already true)
    const { error: updateError } = await serviceClient
      .from("restaurants")
      .update({ is_active: true })
      .eq("id", restaurantId);
    if (updateError) throw updateError;

    return NextResponse.json({ status: "complete", restaurantId }, { status: 200 });
  } catch (error) {
    return handleUnexpectedError(error, "[onboarding][restaurant][complete][POST]");
  }
}
