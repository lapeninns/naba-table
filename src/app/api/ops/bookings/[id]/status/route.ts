import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships } from "@/server/team/access";
import type { Tables } from "@/types/supabase";

const bodySchema = z.object({
  status: z.enum(["completed", "no_show"]),
});

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

async function resolveBookingId(paramsPromise: Promise<{ id: string | string[] }> | undefined): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === "string") return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const id = await resolveBookingId(params);
  if (!id) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    console.error("[ops][booking-status] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: booking, error: bookingError } = await serviceSupabase
    .from("bookings")
    .select("id, restaurant_id, status")
    .eq("id", id)
    .maybeSingle();

  if (bookingError) {
    console.error("[ops][booking-status] failed to load booking", bookingError.message);
    return NextResponse.json({ error: "Unable to load booking" }, { status: 500 });
  }

  const bookingRow = booking as Tables<"bookings"> | null;

  if (!bookingRow) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    const memberships = await fetchUserMemberships(user.id, tenantSupabase);
    const hasAccess = memberships.some((membership) => membership.restaurant_id === bookingRow.restaurant_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    console.error("[ops][booking-status] membership lookup failed", error);
    return NextResponse.json({ error: "Unable to verify permissions" }, { status: 500 });
  }

  if (bookingRow.status === payload.status) {
    return NextResponse.json({ status: bookingRow.status });
  }

  const { data: updated, error: updateError } = await serviceSupabase
    .from("bookings")
    .update({
      status: payload.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();

  if (updateError) {
    console.error("[ops][booking-status] failed to update booking", updateError.message);
    return NextResponse.json({ error: "Unable to update booking" }, { status: 500 });
  }

  return NextResponse.json({ status: updated?.status ?? payload.status });
}
