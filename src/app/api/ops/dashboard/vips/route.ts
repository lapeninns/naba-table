import { NextResponse } from "next/server";
import { z } from "zod";

import { getTodayVIPs } from "@/server/ops/vips";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

import type { NextRequest} from "next/server";

const vipsQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
});

type VIPsQuery = z.infer<typeof vipsQuerySchema>;

function parseQuery(request: NextRequest): VIPsQuery | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = vipsQuerySchema.safeParse(entries);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export async function GET(request: NextRequest) {
  const query = parseQuery(request);
  if (!query) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/dashboard][vips] failed to resolve auth", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: query.restaurantId });
  } catch (membershipError) {
    console.error("[ops/dashboard][vips] membership validation failed", membershipError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!query.date) {
    return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
  }

  try {
    const vipsData = await getTodayVIPs(query.restaurantId, query.date, getServiceSupabaseClient());

    return NextResponse.json(vipsData);
  } catch (vipsError) {
    console.error("[ops/dashboard][vips] failed to load VIP guests", vipsError);
    return NextResponse.json({ error: "Unable to load VIP guests" }, { status: 500 });
  }
}
