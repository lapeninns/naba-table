import { NextResponse } from "next/server";

import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import type { Database } from "@/types/supabase";

type MembershipRow = Database["public"]["Tables"]["restaurant_memberships"]["Row"];
type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

type MembershipResponse = {
  restaurantId: string;
  role: string;
  createdAt: string;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    contactEmail: string | null;
    contactPhone: string | null;
  } | null;
};

function toMembershipResponse(row: MembershipRow, restaurant: RestaurantRow | null): MembershipResponse {
  return {
    restaurantId: row.restaurant_id,
    role: row.role,
    createdAt: row.created_at,
    restaurant: restaurant
      ? {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          timezone: restaurant.timezone,
          contactEmail: restaurant.contact_email,
          contactPhone: restaurant.contact_phone,
        }
      : null,
  };
}

export async function GET() {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[owner/memberships][get] auth error", authError.message);
      return NextResponse.json(
        { code: "AUTH_RESOLUTION_FAILED", message: "Unable to verify your session" },
        { status: 500 },
      );
    }

    if (!user) {
      return NextResponse.json({ code: "UNAUTHENTICATED", message: "Sign in required" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("restaurant_memberships")
      .select(
        `restaurant_id, role, created_at,
        restaurants:restaurants ( id, name, slug, timezone, contact_email, contact_phone )`,
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[owner/memberships][get] query failed", error.message, {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { code: "MEMBERSHIPS_FETCH_FAILED", message: "Could not load your memberships" },
        { status: 500 },
      );
    }

    const items = (data ?? []).map(({ restaurants, ...membership }) => {
      // Supabase returns restaurants as an array, get the first element
      const restaurantData = Array.isArray(restaurants) && restaurants.length > 0 ? restaurants[0] : null;
      return toMembershipResponse(
        membership as MembershipRow,
        restaurantData as RestaurantRow | null
      );
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[owner/memberships][get] unexpected", error);
    return NextResponse.json(
      { code: "UNEXPECTED_ERROR", message: "We ran into an issue loading memberships" },
      { status: 500 },
    );
  }
}
