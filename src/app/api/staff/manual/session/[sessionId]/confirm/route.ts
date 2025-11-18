import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ManualSessionDisabledError,
  SessionConflictError,
  SessionNotFoundError,
  StaleContextError,
  confirmSessionHold,
  loadManualSession,
} from "@/server/capacity/manual-session";
import { AssignTablesRpcError, HoldNotFoundError } from "@/server/capacity/holds";
import { ManualSelectionInputError } from "@/server/capacity/table-assignment";
import { mapAssignTablesErrorToHttp } from "@/app/api/staff/_utils/assign-tables-error";
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const confirmSchema = z.object({
  bookingId: z.string().uuid(),
  holdId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  requireAdjacency: z.boolean().optional(),
  contextVersion: z.string().optional(),
  selectionVersion: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { bookingId, holdId, idempotencyKey, requireAdjacency, contextVersion, selectionVersion } = parsed.data;

  const bookingLookup = await supabase
    .from("bookings")
    .select("restaurant_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    return NextResponse.json({ error: "Failed to load booking", code: "BOOKING_LOOKUP_FAILED" }, { status: 500 });
  }
  const bookingRow = bookingLookup.data;
  if (!bookingRow?.restaurant_id) {
    return NextResponse.json({ error: "Booking not found", code: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const membership = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", bookingRow.restaurant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership.error) {
    return NextResponse.json({ error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" }, { status: 500 });
  }
  if (!membership.data) {
    return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
  }

  const serviceClient = getTenantServiceSupabaseClient(bookingRow.restaurant_id);

  try {
    const session = await loadManualSession({ sessionId, client: serviceClient });
    if (session.bookingId !== bookingId) {
      return NextResponse.json(
        { error: "Session belongs to a different booking", code: "SESSION_BOOKING_MISMATCH" },
        { status: 409 },
      );
    }

    const result = await confirmSessionHold({
      sessionId,
      bookingId,
      restaurantId: bookingRow.restaurant_id,
      holdId,
      idempotencyKey,
      requireAdjacency,
      contextVersion,
      selectionVersion,
      assignedBy: user.id,
      client: serviceClient,
    });

    return NextResponse.json({
      session: result.session,
      assignments: result.assignments,
      context: result.context,
    });
  } catch (error) {
    if (error instanceof ManualSessionDisabledError) {
      return NextResponse.json({ error: error.message, code: "SESSION_DISABLED" }, { status: 404 });
    }
    if (error instanceof SessionNotFoundError) {
      return NextResponse.json({ error: error.message, code: "SESSION_NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof StaleContextError) {
      return NextResponse.json(
        { error: error.message, code: "STALE_CONTEXT", details: { expected: error.expected, provided: error.provided } },
        { status: 409 },
      );
    }
    if (error instanceof SessionConflictError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 409 },
      );
    }
    if (error instanceof HoldNotFoundError) {
      return NextResponse.json({ error: error.message, code: "HOLD_NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof ManualSelectionInputError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof AssignTablesRpcError) {
      const { status, payload } = mapAssignTablesErrorToHttp(error);
      return NextResponse.json(payload, { status });
    }
    console.error("[staff/manual/session/confirm] unexpected error", { error, sessionId, bookingId, userId: user.id });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
