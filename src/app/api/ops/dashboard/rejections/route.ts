import { NextResponse } from "next/server";
import { z } from "zod";

import { getRejectionAnalytics } from "@/server/ops/rejections";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

import type { NextRequest } from "next/server";

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  from: z.string().optional(),
  to: z.string().optional(),
  bucket: z.enum(["day", "hour"]).optional(),
});

type RejectionsQuery = z.infer<typeof querySchema>;

function parseQuery(request: NextRequest): RejectionsQuery | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = querySchema.safeParse(entries);
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
    console.error("[ops/dashboard][rejections] failed to resolve auth", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: query.restaurantId });
  } catch (membershipError) {
    console.error("[ops/dashboard][rejections] membership validation failed", membershipError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const analytics = await getRejectionAnalytics(query.restaurantId, {
      client: getServiceSupabaseClient(),
      from: query.from,
      to: query.to,
      bucket: query.bucket,
    });

    return NextResponse.json(analytics);
  } catch (analyticsError) {
    console.error("[ops/dashboard][rejections] failed to load analytics", analyticsError);
    return NextResponse.json({ error: "Unable to load rejection analytics" }, { status: 500 });
  }
}
