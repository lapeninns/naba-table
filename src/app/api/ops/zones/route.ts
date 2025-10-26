import { NextResponse } from "next/server";
import { z } from "zod";

import { createZone, listZones } from "@/server/ops/zones";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

import type { NextRequest} from "next/server";

const querySchema = z.object({
  restaurantId: z.string().uuid(),
});

const createSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().min(-1000).max(1000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "restaurantId is required", message: "restaurantId is required" },
        { status: 400 },
      );
    }

    const { restaurantId } = parsed.data;

    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Access denied to this restaurant", message: "Access denied to this restaurant" },
        { status: 403 },
      );
    }

    try {
      const zones = await listZones(supabase, restaurantId);
      return NextResponse.json({ zones });
    } catch (error) {
      console.error("[ops/zones][GET] Failed to list zones", { error });
      return NextResponse.json(
        { error: "Failed to load zones", message: "Failed to load zones" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[ops/zones][GET] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const trimmedName = data.name.trim();
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { error: "Zone name cannot be blank", message: "Zone name cannot be blank" },
        { status: 400 },
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", data.restaurantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Access denied to this restaurant", message: "Access denied to this restaurant" },
        { status: 403 },
      );
    }

    try {
      const zone = await createZone(supabase, {
        restaurantId: data.restaurantId,
        name: trimmedName,
        sortOrder: data.sortOrder ?? 0,
      });
      return NextResponse.json({ zone }, { status: 201 });
    } catch (error) {
      console.error("[ops/zones][POST] Create error", { error });
      return NextResponse.json(
        { error: "Failed to create zone", message: "Failed to create zone" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[ops/zones][POST] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
