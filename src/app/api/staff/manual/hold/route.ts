import { NextResponse } from "next/server";
import { z } from "zod";

import { ManualSelectionInputError } from "@/server/capacity/engine";
import { HoldConflictError, releaseTableHold } from "@/server/capacity/holds";
import { getOrCreateManualSession, proposeOrHoldSelection, StaleContextError, SessionConflictError } from "@/server/capacity/manual-session";
import { emitManualHold } from "@/server/capacity/telemetry";
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const holdPayloadSchema = z.object({
  bookingId: z.string().uuid(),
  tableIds: z.array(z.string().uuid()).min(1),
  holdTtlSeconds: z.number().int().min(30).max(600).optional(),
  requireAdjacency: z.boolean().optional(),
  excludeHoldId: z.string().uuid().optional(),
  contextVersion: z.string(),
});

const holdReleaseSchema = z.object({
  holdId: z.string().uuid(),
  bookingId: z.string().uuid(),
});

const VALIDATION_CODE_MAP: Record<string, string> = {
  capacity: "CAPACITY_INSUFFICIENT",
  slack: "SLACK_BUDGET_EXCEEDED",
  zone: "ZONE_MISMATCH",
  movable: "TABLE_IMMUTABLE",
  adjacency: "ADJACENCY_INVALID",
  conflict: "ASSIGNMENT_CONFLICT",
  holds: "HOLD_CONFLICT",
};

function deriveValidationCode(validation: { checks: Array<{ id: string; status: string }> }): string {
  const failing = validation.checks.find((check) => check.status === "error");
  return failing ? VALIDATION_CODE_MAP[failing.id] ?? "VALIDATION_FAILED" : "VALIDATION_FAILED";
}

export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = holdPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { bookingId, tableIds, holdTtlSeconds, requireAdjacency, excludeHoldId, contextVersion } = parsed.data;

  const bookingLookup = await supabase
    .from("bookings")
    .select("restaurant_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    console.error("[staff/manual/hold] booking lookup failed", { bookingId, error: bookingLookup.error });
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
    console.error("[staff/manual/hold] membership lookup failed", { bookingId, error: membership.error });
    return NextResponse.json({ error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" }, { status: 500 });
  }

  if (!membership.data) {
    return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
  }

  const serviceClient = getTenantServiceSupabaseClient(bookingRow.restaurant_id);

  const session = await getOrCreateManualSession({
    bookingId,
    restaurantId: bookingRow.restaurant_id,
    createdBy: user.id,
    client: serviceClient,
  });

  let contextAdjacencyRequired: boolean | null = null;

  try {
    const result = await proposeOrHoldSelection({
      sessionId: session.id,
      bookingId,
      restaurantId: bookingRow.restaurant_id,
      tableIds,
      mode: "hold",
      requireAdjacency,
      excludeHoldId,
      contextVersion,
      selectionVersion: session.selectionVersion,
      createdBy: user.id,
      holdTtlSeconds,
      client: serviceClient,
    });
    contextAdjacencyRequired = Boolean(result.context.flags?.adjacencyRequired ?? null);

    if (!result.hold) {
      const summary = result.validation.summary;
      const code = deriveValidationCode(result.validation);
      const status = code === "HOLD_CONFLICT" ? 409 : 422;

      await emitManualHold({
        ok: false,
        bookingId,
        restaurantId: bookingRow.restaurant_id,
        policyVersion: result.validation.policyVersion ?? null,
        adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === 'boolean' ? requireAdjacency : null),
        code,
      });

      return NextResponse.json(
        {
          error: "Validation failed",
          code,
          validation: result.validation,
          summary,
          details: {
            validation: result.validation,
            summary,
          },
        },
        { status },
      );
    }

    await emitManualHold({
      ok: true,
      bookingId,
      restaurantId: bookingRow.restaurant_id,
      policyVersion: result.validation.policyVersion ?? result.context.policyVersion ?? null,
      adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === 'boolean' ? requireAdjacency : null),
    });

    return NextResponse.json({
      hold: {
        id: result.hold.id,
        expiresAt: result.hold.expiresAt,
        startAt: result.hold.startAt,
        endAt: result.hold.endAt,
        zoneId: result.hold.zoneId,
        tableIds: result.hold.tableIds,
      },
      serverNow: new Date().toISOString(),
      summary: result.validation.summary,
      validation: result.validation,
      session: result.session,
      contextVersion: result.context.contextVersion ?? null,
    });
  } catch (error) {
    if (error instanceof StaleContextError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "STALE_CONTEXT",
          details: { expected: error.expected, provided: error.provided },
        },
        { status: 409 },
      );
    }
    if (error instanceof SessionConflictError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 409 },
      );
    }
    if (error instanceof ManualSelectionInputError) {
      await emitManualHold({
        ok: false,
        bookingId,
        restaurantId: bookingRow.restaurant_id,
        policyVersion: null,
        adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === 'boolean' ? requireAdjacency : null),
        code: error.code,
      });
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    if (error instanceof HoldConflictError) {
      await emitManualHold({
        ok: false,
        bookingId,
        restaurantId: bookingRow.restaurant_id,
        policyVersion: null,
        adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === 'boolean' ? requireAdjacency : null),
        code: "HOLD_CONFLICT",
      });
      return NextResponse.json(
        {
          error: error.message,
          code: "HOLD_CONFLICT",
          holdId: error.holdId ?? null,
        },
        { status: 409 },
      );
    }

    console.error("[staff/manual/hold] unexpected error", { error, bookingId, userId: user.id });
    await emitManualHold({
      ok: false,
      bookingId,
      restaurantId: bookingRow.restaurant_id,
      policyVersion: null,
      adjacencyRequired: contextAdjacencyRequired ?? (typeof requireAdjacency === 'boolean' ? requireAdjacency : null),
      code: "INTERNAL_ERROR",
    });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = holdReleaseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { holdId, bookingId } = parsed.data;

  const holdLookup = await supabase
    .from("table_holds")
    .select("restaurant_id, booking_id")
    .eq("id", holdId)
    .maybeSingle();

  if (holdLookup.error) {
    console.error("[staff/manual/hold][delete] hold lookup failed", { holdId, error: holdLookup.error });
    return NextResponse.json({ error: "Failed to load hold", code: "HOLD_LOOKUP_FAILED" }, { status: 500 });
  }

  const holdRow = holdLookup.data;
  if (!holdRow?.restaurant_id) {
    return NextResponse.json({ error: "Hold not found", code: "HOLD_NOT_FOUND" }, { status: 404 });
  }

  if (holdRow.booking_id && holdRow.booking_id !== bookingId) {
    return NextResponse.json(
      { error: "Hold belongs to a different booking", code: "HOLD_BOOKING_MISMATCH" },
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
    console.error("[staff/manual/hold][delete] membership lookup failed", { holdId, error: membership.error });
    return NextResponse.json({ error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" }, { status: 500 });
  }

  if (!membership.data) {
    return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
  }

  const serviceClient = getTenantServiceSupabaseClient(holdRow.restaurant_id);

  try {
    await releaseTableHold({ holdId, client: serviceClient });
    return NextResponse.json({ holdId, released: true });
  } catch (error) {
    console.error("[staff/manual/hold][delete] failed to release hold", { holdId, error });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "RELEASE_FAILED" }, { status: 500 });
  }
}
