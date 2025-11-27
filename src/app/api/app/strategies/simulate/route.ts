import { NextResponse } from "next/server";
import { z } from "zod";

import { isOpsRejectionAnalyticsEnabled } from "@/server/feature-flags";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { requireAdminMembership } from "@/server/team/access";

import type { NextRequest } from "next/server";

const payloadSchema = z.object({
  restaurantId: z.string().uuid(),
  strategies: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        label: z.string().min(1).max(120),
        weights: z.object({
          scarcity: z.number().min(0).max(1000).optional(),
          demandMultiplier: z.number().min(0).max(10).nullable().optional(),
          futureConflictPenalty: z.number().min(0).max(100000).nullable().optional(),
        }),
      }),
    )
    .min(1)
    .max(4),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  if (!isOpsRejectionAnalyticsEnabled()) {
    return NextResponse.json({ error: "Simulation feature is disabled" }, { status: 404 });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/strategies/simulate][POST] auth lookup failed", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsedPayload = payloadSchema.safeParse(await request.json().catch(() => null));

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { restaurantId, strategies, notes } = parsedPayload.data;

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
  } catch (accessError) {
    console.error("[ops/strategies/simulate][POST] membership check failed", accessError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const timestamp = new Date().toISOString();

  return NextResponse.json(
    {
      status: "queued",
      restaurantId,
      receivedAt: timestamp,
      strategies: strategies.map((strategy) => ({
        key: strategy.key,
        label: strategy.label,
        weights: strategy.weights,
      })),
      notes: notes ?? null,
      message: "Simulation job scheduling is not yet implemented. This endpoint returns a placeholder response while the pipeline is defined.",
    },
    { status: 202 },
  );
}

export function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 405 });
}
