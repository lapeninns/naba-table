import { NextResponse } from "next/server";
import { z } from "zod";

import { getStrategicConfigSnapshot } from "@/server/capacity/strategic-config";
import { clearStrategicCaches } from "@/server/capacity/strategic-maintenance";
import { fetchStrategicConfig, upsertStrategicConfig } from "@/server/ops/strategic-config";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireAdminMembership, requireMembershipForRestaurant } from "@/server/team/access";

import type { NextRequest } from "next/server";

const getQuerySchema = z.object({
  restaurantId: z.string().uuid(),
});

const payloadSchema = z.object({
  restaurantId: z.string().uuid(),
  weights: z.object({
    scarcity: z.number().min(0).max(1000),
    demandMultiplier: z.number().min(0).max(10).nullable().optional(),
    futureConflictPenalty: z.number().min(0).max(100000).nullable().optional(),
  }),
});

function formatResponse(params: {
  restaurantId: string;
  source: "db" | "env";
  scarcityWeight: number;
  demandMultiplierOverride: number | null;
  futureConflictPenalty: number | null;
  updatedAt: string | null;
}) {
  return {
    restaurantId: params.restaurantId,
    source: params.source,
    weights: {
      scarcity: params.scarcityWeight,
      demandMultiplier: params.demandMultiplierOverride,
      futureConflictPenalty: params.futureConflictPenalty,
    },
    updatedAt: params.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const query = getQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!query.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { restaurantId } = query.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/settings][strategic-config][GET] auth lookup failed", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId });
  } catch (membershipError) {
    console.error("[ops/settings][strategic-config][GET] membership check failed", membershipError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const record = await fetchStrategicConfig({ restaurantId, client: getServiceSupabaseClient() });
    if (record) {
      return NextResponse.json(
        formatResponse({
          restaurantId,
          source: "db",
          scarcityWeight: record.scarcity_weight,
          demandMultiplierOverride: record.demand_multiplier_override,
          futureConflictPenalty: record.future_conflict_penalty,
          updatedAt: record.updated_at,
        }),
      );
    }

    const snapshot = getStrategicConfigSnapshot({ restaurantId });
    return NextResponse.json(
      formatResponse({
        restaurantId,
        source: snapshot.source,
        scarcityWeight: snapshot.scarcityWeight,
        demandMultiplierOverride: snapshot.demandMultiplierOverride,
        futureConflictPenalty: snapshot.futureConflictPenalty,
        updatedAt: snapshot.updatedAt,
      }),
    );
  } catch (settingsError) {
    console.error("[ops/settings][strategic-config][GET] failed to load config", settingsError);
    return NextResponse.json({ error: "Unable to load strategic settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const payload = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { restaurantId, weights } = payload.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/settings][strategic-config][POST] auth lookup failed", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
  } catch (membershipError) {
    console.error("[ops/settings][strategic-config][POST] membership check failed", membershipError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const record = await upsertStrategicConfig({
      restaurantId,
      scarcityWeight: weights.scarcity,
      demandMultiplierOverride: weights.demandMultiplier ?? null,
      futureConflictPenalty: weights.futureConflictPenalty ?? null,
      updatedBy: user.id,
      client: getServiceSupabaseClient(),
    });

    clearStrategicCaches();

    return NextResponse.json(
      formatResponse({
        restaurantId,
        source: "db",
        scarcityWeight: record.scarcity_weight,
        demandMultiplierOverride: record.demand_multiplier_override,
        futureConflictPenalty: record.future_conflict_penalty,
        updatedAt: record.updated_at,
      }),
    );
  } catch (updateError) {
    console.error("[ops/settings][strategic-config][POST] failed to update config", updateError);
    return NextResponse.json({ error: "Unable to update strategic settings" }, { status: 500 });
  }
}
