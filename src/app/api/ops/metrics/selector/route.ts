import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { isOpsMetricsEnabled } from "@/server/feature-flags";

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type RouteSupabaseClient = Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;

function ensureFeatureEnabled() {
  if (!isOpsMetricsEnabled()) {
    return NextResponse.json({ error: "Selector metrics feature is disabled" }, { status: 404 });
  }
  return null;
}

type SelectorEvent = {
  event_type: string;
  created_at: string;
  context: Record<string, any> | null;
};

function normaliseDate(value?: string) {
  if (!value) {
    return DateTime.utc();
  }
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed : DateTime.utc();
}

function computePercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((percentile / 100) * sorted.length)));
  return sorted[index] ?? null;
}

async function fetchEvents(client: RouteSupabaseClient, restaurantId: string, startIso: string, endIso: string) {
  const { data, error } = await client
    .from("observability_events")
    .select("event_type, context, created_at")
    .eq("source", "capacity.selector")
    .contains("context", { restaurantId })
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SelectorEvent[];
}

export async function GET(req: NextRequest) {
  const featureCheck = ensureFeatureEnabled();
  if (featureCheck) {
    return featureCheck;
  }

  const supabase = await getRouteHandlerSupabaseClient();

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });
  }

  const { restaurantId, date } = parsed.data;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const targetDate = normaliseDate(date);
  const startIso = targetDate.startOf("day").toISO();
  const endIso = targetDate.plus({ days: 1 }).startOf("day").toISO();

  if (!startIso || !endIso) {
    return NextResponse.json({ error: "Failed to resolve date range" }, { status: 500 });
  }

  try {
    const events = await fetchEvents(supabase, restaurantId, startIso, endIso);

    let assignmentsTotal = 0;
    let skippedTotal = 0;
    let mergeCount = 0;
    let overageSum = 0;
    const skipReasons = new Map<string, number>();
    const durations: number[] = [];
    const samples: any[] = [];

    for (const event of events) {
      const context = event.context ?? {};
      const selected = context.selected ?? null;
      const skipReason = context.skipReason ?? null;
      const durationMs = Number(context.durationMs ?? 0);

      if (Number.isFinite(durationMs) && durationMs > 0) {
        durations.push(durationMs);
      }

      if (selected) {
        assignmentsTotal += 1;
        const tableCount = Number(selected.tableCount ?? selected.tableIds?.length ?? 0);
        if (tableCount > 1) {
          mergeCount += 1;
        }
        const slack = Number(selected.slack ?? 0);
        if (Number.isFinite(slack)) {
          overageSum += slack;
        }
      } else {
        skippedTotal += 1;
        if (typeof skipReason === "string" && skipReason.length > 0) {
          skipReasons.set(skipReason, (skipReasons.get(skipReason) ?? 0) + 1);
        }
      }

      if (samples.length < 10) {
        samples.push({
          createdAt: event.created_at,
          bookingId: context.bookingId ?? null,
          selected,
          skipReason,
          topCandidates: context.topCandidates ?? [],
          durationMs,
        });
      }
    }

    const avgOverage = assignmentsTotal > 0 ? overageSum / assignmentsTotal : 0;
    const mergeRate = assignmentsTotal > 0 ? mergeCount / assignmentsTotal : 0;
    const avgDuration = durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
    const p95Duration = computePercentile(durations, 95) ?? null;

    return NextResponse.json({
      summary: {
        assignmentsTotal,
        skippedTotal,
        mergeRate,
        avgOverage,
        avgDurationMs: avgDuration,
        p95DurationMs: p95Duration,
      },
      skipReasons: Array.from(skipReasons.entries()).map(([reason, count]) => ({ reason, count })),
      samples,
    });
  } catch (error) {
    console.error("[ops/metrics/selector][GET] failed", { error, restaurantId, date });
    return NextResponse.json({ error: "Failed to load selector metrics" }, { status: 500 });
  }
}
