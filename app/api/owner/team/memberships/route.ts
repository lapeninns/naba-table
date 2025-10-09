import { NextResponse } from "next/server";

import { fetchUserMemberships } from "@/server/team/access";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[team/memberships] auth error", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const memberships = await fetchUserMemberships(user.id);
    return NextResponse.json({
      memberships: memberships.map((membership) => ({
        restaurantId: membership.restaurant_id,
        role: membership.role,
        restaurant: {
          id: membership.restaurants?.id ?? membership.restaurant_id,
          name: membership.restaurants?.name ?? null,
          slug: membership.restaurants?.slug ?? null,
        },
      })),
    });
  } catch (error) {
    console.error("[team/memberships] failed to load memberships", error);
    return NextResponse.json({ error: "Unable to load memberships" }, { status: 500 });
  }
}
