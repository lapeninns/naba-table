import { NextResponse } from "next/server";
import { z } from "zod";

import { AssignTablesRpcError, HoldNotFoundError } from "@/server/capacity/holds";
import { confirmHoldAssignment, getManualAssignmentContext } from "@/server/capacity/tables";
import { emitManualConfirm } from "@/server/capacity/telemetry";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const confirmPayloadSchema = z.object({
  bookingId: z.string().uuid(),
  holdId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  requireAdjacency: z.boolean().optional(),
  contextVersion: z.string(),
});

export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized", error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid request payload",
        error: "Invalid request payload",
        code: "INVALID_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { bookingId, holdId, idempotencyKey, requireAdjacency, contextVersion } = parsed.data;

  const holdLookup = await supabase
    .from("table_holds")
    .select("restaurant_id, booking_id")
    .eq("id", holdId)
    .maybeSingle();

  if (holdLookup.error) {
    console.error("[staff/manual/confirm] hold lookup failed", { holdId, error: holdLookup.error });
    return NextResponse.json(
      { message: "Failed to load hold", error: "Failed to load hold", code: "HOLD_LOOKUP_FAILED" },
      { status: 500 },
    );
  }

  const holdRow = holdLookup.data;
  if (!holdRow?.restaurant_id) {
    return NextResponse.json(
      { message: "Hold not found", error: "Hold not found", code: "HOLD_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (holdRow.booking_id && holdRow.booking_id !== bookingId) {
    return NextResponse.json(
      {
        message: "Hold belongs to a different booking",
        error: "Hold belongs to a different booking",
        code: "HOLD_BOOKING_MISMATCH",
      },
      { status: 409 },
    );
  }

  const membership = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", holdRow.restaurant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership.error) {
    console.error("[staff/manual/confirm] membership lookup failed", { holdId, error: membership.error });
    return NextResponse.json(
      { message: "Failed to verify access", error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" },
      { status: 500 },
    );
  }

  if (!membership.data) {
    return NextResponse.json(
      { message: "Access denied", error: "Access denied", code: "ACCESS_DENIED" },
      { status: 403 },
    );
  }

  const serviceClient = getServiceSupabaseClient();

  // Require fresh context before confirming
  let contextAdjacencyRequired: boolean | null = null;
  try {
    const context = await getManualAssignmentContext({ bookingId, client: serviceClient });
    contextAdjacencyRequired = Boolean((context as any)?.flags?.adjacencyRequired ?? null);
    if (context.contextVersion && context.contextVersion !== contextVersion) {
      return NextResponse.json(
        {
          message: "Stale context; please refresh",
          error: "Stale context; please refresh",
          code: "STALE_CONTEXT",
          details: { expected: context.contextVersion, provided: contextVersion },
        },
        { status: 409 },
      );
    }
  } catch {
    // proceed; DB/allocator will still validate
  }

  try {
    const assignments = await confirmHoldAssignment({
      holdId,
      bookingId,
      idempotencyKey,
      requireAdjacency,
      assignedBy: user.id,
      client: serviceClient,
    });
    await emitManualConfirm({
      ok: true,
      bookingId,
      restaurantId: holdRow.restaurant_id,
      policyVersion: null, // computed in allocator; omit here
      adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === 'boolean' ? requireAdjacency : null),
    });
    return NextResponse.json({
      holdId,
      bookingId,
      assignments,
    });
  } catch (error) {
    if (error instanceof HoldNotFoundError) {
      await emitManualConfirm({
        ok: false,
        bookingId,
        restaurantId: holdRow.restaurant_id,
        policyVersion: null,
        adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === 'boolean' ? requireAdjacency : null),
        code: "HOLD_NOT_FOUND",
      });
      return NextResponse.json(
        { message: error.message, error: error.message, code: "HOLD_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (error instanceof AssignTablesRpcError) {
      const status =
        error.code === "ASSIGNMENT_VALIDATION"
          ? 422
          : error.code === "ASSIGNMENT_REPOSITORY_ERROR"
            ? 503
            : error.code === "HOLD_LOOKUP_FAILED"
              ? 500
              : 409;
      await emitManualConfirm({
        ok: false,
        bookingId,
        restaurantId: holdRow.restaurant_id,
        policyVersion: null,
        adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === 'boolean' ? requireAdjacency : null),
        code: error.code ?? "ASSIGNMENT_CONFLICT",
      });
      return NextResponse.json(
        {
          message: error.message,
          error: error.message,
          code: error.code ?? "ASSIGNMENT_CONFLICT",
          details: error.details ?? null,
          hint: error.hint ?? null,
        },
        { status },
      );
    }

    console.error("[staff/manual/confirm] unexpected error", { error, holdId, bookingId, userId: user.id });
    await emitManualConfirm({
      ok: false,
      bookingId,
      restaurantId: holdRow.restaurant_id,
      policyVersion: null,
      adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === 'boolean' ? requireAdjacency : null),
      code: "INTERNAL_ERROR",
    });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      { message, error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
