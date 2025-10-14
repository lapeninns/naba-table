import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { formatDateForInput } from "@reserve/shared/formatting/booking";
import { fromMinutes } from "@reserve/shared/time";

import {
  buildBookingAuditSnapshot,
  logAuditEvent,
  softCancelBooking,
  updateBookingRecord,
} from "@/server/bookings";
import { enqueueBookingCancelledSideEffects, enqueueBookingUpdatedSideEffects, safeBookingPayload } from "@/server/jobs/booking-side-effects";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";
import type { BookingRecord } from "@/server/bookings";
import type { Json, Tables } from "@/types/supabase";

const dashboardUpdateSchema = z.object({
  startIso: z.string().datetime(),
  endIso: z.string().datetime(),
  partySize: z.number().int().min(1),
  notes: z.string().max(500).optional().nullable(),
});

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

function resolveBookingId(paramsPromise: Promise<{ id: string | string[] }> | undefined): Promise<string | null> {
  if (!paramsPromise) return Promise.resolve(null);

  return paramsPromise.then((params) => {
    const { id } = params;
    if (typeof id === "string") return id;
    if (Array.isArray(id)) return id[0] ?? null;
    return null;
  });
}

function toIsoString(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = dashboardUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    console.error("[ops/bookings][PATCH] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = getServiceSupabaseClient();
  const { data: existing, error } = await serviceSupabase
    .from("bookings")
    .select("*, restaurants(name)")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[ops/bookings][PATCH] failed to load booking", error);
    return NextResponse.json({ error: "Unable to load booking" }, { status: 500 });
  }

  const existingBooking = existing as (Tables<"bookings"> & { restaurants?: { name: string | null } | { name: string | null }[] | null }) | null;

  if (!existingBooking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId: existingBooking.restaurant_id,
      client: tenantSupabase,
    });
  } catch (membershipError) {
    console.warn("[ops/bookings][PATCH] membership denied", {
      bookingId,
      reason: membershipError instanceof Error ? membershipError.message : membershipError,
    });
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const startDate = new Date(parsed.data.startIso);
  const endDate = new Date(parsed.data.endIso);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid date values" }, { status: 400 });
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  const bookingDate = formatDateForInput(startDate);
  const startTime = fromMinutes(startDate.getHours() * 60 + startDate.getMinutes());
  const endTime = fromMinutes(endDate.getHours() * 60 + endDate.getMinutes());

  try {
    const updated = await updateBookingRecord(serviceSupabase, bookingId, {
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      party_size: parsed.data.partySize,
      notes: parsed.data.notes ?? null,
    });

    const auditMetadata = {
      restaurant_id: updated.restaurant_id ?? existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: "booking.updated",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: user.email ?? user.id ?? "ops",
    });

    try {
      await enqueueBookingUpdatedSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          current: safeBookingPayload(updated),
          restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id,
        },
        { supabase: serviceSupabase },
      );
    } catch (jobError) {
      console.error("[ops/bookings][PATCH] side effects failed", jobError);
    }

    const restaurantRelation = Array.isArray(existingBooking.restaurants)
      ? existingBooking.restaurants[0] ?? null
      : existingBooking.restaurants ?? null;

    const response = {
      id: updated.id,
      restaurantName: restaurantRelation?.name ?? "",
      partySize: updated.party_size,
      startIso: toIsoString(updated.start_at),
      endIso: toIsoString(updated.end_at),
      status: updated.status,
      notes: updated.notes ?? null,
    };

    return NextResponse.json(response);
  } catch (updateError) {
    console.error("[ops/bookings][PATCH] update failed", updateError);
    return NextResponse.json({ error: "Unable to update booking" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    console.error("[ops/bookings][DELETE] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = getServiceSupabaseClient();
  const { data: existing, error } = await serviceSupabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[ops/bookings][DELETE] failed to load booking", error);
    return NextResponse.json({ error: "Unable to load booking" }, { status: 500 });
  }

  const existingBooking = existing as Tables<"bookings"> | null;

  if (!existingBooking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId: existingBooking.restaurant_id,
      client: tenantSupabase,
    });
  } catch (membershipError) {
    console.warn("[ops/bookings][DELETE] membership denied", {
      bookingId,
      reason: membershipError instanceof Error ? membershipError.message : membershipError,
    });
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    const cancelled = await softCancelBooking(serviceSupabase, bookingId);

    const auditMetadata = {
      restaurant_id: existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, cancelled),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: "booking.cancelled",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: user.email ?? user.id ?? "ops",
    });

    try {
      await enqueueBookingCancelledSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          cancelled: safeBookingPayload(cancelled),
          restaurantId: existingBooking.restaurant_id,
          cancelledBy: "staff",
        },
        { supabase: serviceSupabase },
      );
    } catch (jobError) {
      console.error("[ops/bookings][DELETE] side effects failed", jobError);
    }

    return NextResponse.json({ id: bookingId, status: cancelled.status });
  } catch (deleteError) {
    console.error("[ops/bookings][DELETE] cancellation failed", deleteError);

    if (typeof deleteError === "object" && deleteError !== null) {
      const record = deleteError as { code?: string; message?: string };
      if (record.code === "42501") {
        return NextResponse.json(
          {
            error: "This booking can no longer be cancelled online.",
            code: "CUTOFF_PASSED",
          },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({ error: "Unable to cancel booking" }, { status: 500 });
  }
}
