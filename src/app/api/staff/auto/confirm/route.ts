import { NextResponse } from "next/server";
import { z } from "zod";

import { AssignTablesRpcError, HoldNotFoundError } from "@/server/capacity/holds";
import { confirmHold } from "@/server/capacity/engine";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const confirmPayloadSchema = z.object({
  holdId: z.string().uuid(),
  bookingId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  requireAdjacency: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { holdId, bookingId, idempotencyKey, requireAdjacency } = parsed.data;

  const holdLookup = await supabase
    .from("table_holds")
    .select("id, restaurant_id")
    .eq("id", holdId)
    .maybeSingle();

  if (holdLookup.error) {
    return NextResponse.json({ error: holdLookup.error.message }, { status: 500 });
  }

  const holdRow = holdLookup.data;
  if (!holdRow || !holdRow.restaurant_id) {
    return NextResponse.json({ error: "Hold not found" }, { status: 404 });
  }

  const membership = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", holdRow.restaurant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership.error) {
    return NextResponse.json({ error: membership.error.message }, { status: 500 });
  }

  if (!membership.data) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const serviceClient = getServiceSupabaseClient();
    const assignments = await confirmHold({
      holdId,
      bookingId,
      idempotencyKey,
      requireAdjacency,
      // pass-through for legacy impl
      ...( { assignedBy: user.id, client: serviceClient } as any ),
    });

    return NextResponse.json({
      holdId,
      bookingId,
      assignments,
    });
  } catch (error) {
    if (error instanceof HoldNotFoundError) {
      return NextResponse.json({ error: "Hold not found" }, { status: 404 });
    }

    if (error instanceof AssignTablesRpcError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 409 },
      );
    }

    console.error("[staff/auto/confirm] unexpected error", { error, holdId, bookingId });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
