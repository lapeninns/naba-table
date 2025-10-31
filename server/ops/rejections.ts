import { DateTime } from "luxon";

import { getServiceSupabaseClient } from "@/server/supabase";

import type { OpsRejectionAnalytics, OpsRejectionBucket, OpsStrategicPenaltyKey, OpsStrategicSample } from "@/types/ops";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public">;

type ObservabilityRow = {
  id: string;
  created_at: string;
  booking_id: string | null;
  context: Record<string, unknown> | null;
};

const DEFAULT_LIMIT = 5000;
const DEFAULT_RANGE_DAYS = 1;
const STRATEGIC_KEYWORDS = [
  /no suitable tables/i,
  /conflicts?/i,
  /future conflict/i,
  /strategic/i,
  /lookahead/i,
];

type FetchOptions = {
  client?: DbClient;
  from?: string;
  to?: string;
  bucket?: OpsRejectionBucket;
  limit?: number;
};

type StrategicPenalties = {
  slack: number;
  scarcity: number;
  futureConflict: number;
  dominant: OpsStrategicPenaltyKey;
};

function parseIsoDate(input: string | undefined, fallback: DateTime): DateTime {
  if (!input) {
    return fallback;
  }
  const parsed = DateTime.fromISO(input, { zone: "utc" });
  return parsed.isValid ? parsed : fallback;
}

function normalizePenaltyKey(value: unknown): OpsStrategicPenaltyKey {
  if (value === "slack" || value === "scarcity" || value === "future_conflict" || value === "structural") {
    return value;
  }
  return "unknown";
}

function extractPenaltiesFromContext(context: Record<string, unknown> | null | undefined): StrategicPenalties | null {
  if (!context || typeof context !== "object") {
    return null;
  }

  const telemetry = context.strategicPenalties as Record<string, unknown> | null | undefined;
  if (!telemetry || typeof telemetry !== "object") {
    return null;
  }

  const slack = Number(telemetry.slack ?? telemetry.slack_penalty ?? 0) || 0;
  const scarcity = Number(telemetry.scarcity ?? telemetry.scarcity_penalty ?? 0) || 0;
  const futureConflict = Number(telemetry.futureConflict ?? telemetry.future_conflict_penalty ?? 0) || 0;
  const dominant = normalizePenaltyKey(telemetry.dominant);

  if (slack === 0 && scarcity === 0 && futureConflict === 0) {
    return null;
  }

  let resolvedDominant = dominant;
  if (resolvedDominant === "unknown") {
    const contributions: Array<[OpsStrategicPenaltyKey, number]> = [
      ["slack", slack],
      ["scarcity", scarcity],
      ["future_conflict", futureConflict],
    ];
    let highest: OpsStrategicPenaltyKey = "unknown";
    let max = 0;
    for (const [key, value] of contributions) {
      if (value > max) {
        highest = key;
        max = value;
      }
    }
    resolvedDominant = max > 0 ? highest : "unknown";
  }

  return {
    slack,
    scarcity,
    futureConflict,
    dominant: resolvedDominant,
  };
}

function deriveClassification(
  explicitClassification: unknown,
  skipReason: string | null,
  penalties: StrategicPenalties | null,
): "hard" | "strategic" {
  if (explicitClassification === "strategic" || explicitClassification === "hard") {
    return explicitClassification;
  }
  if (penalties) {
    return "strategic";
  }
  if (skipReason && STRATEGIC_KEYWORDS.some((pattern) => pattern.test(skipReason))) {
    return "strategic";
  }
  return "hard";
}

function normalizePlannerConfig(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function toSeriesKey(date: DateTime, bucket: OpsRejectionBucket): string {
  if (bucket === "hour") {
    return (
      date.startOf("hour").toUTC().toISO({ suppressMilliseconds: true, suppressSeconds: true }) ??
      date.toISO() ??
      date.toString()
    );
  }
  return (
    date.startOf("day").toUTC().toISODate() ??
    date.toISODate() ??
    date.toISO() ??
    date.toString()
  );
}

function compareDescendingByDate(a: OpsStrategicSample, b: OpsStrategicSample): number {
  return DateTime.fromISO(b.createdAt).toMillis() - DateTime.fromISO(a.createdAt).toMillis();
}

export async function getRejectionAnalytics(
  restaurantId: string,
  options: FetchOptions = {},
): Promise<OpsRejectionAnalytics> {
  const client = options.client ?? getServiceSupabaseClient();
  const bucket: OpsRejectionBucket = options.bucket ?? "day";

  const toDateDefault = DateTime.utc();
  const toDate = parseIsoDate(options.to, toDateDefault);
  const fromDate = parseIsoDate(options.from, toDate.minus({ days: DEFAULT_RANGE_DAYS }));

  const normalizedFrom = fromDate <= toDate ? fromDate : toDate.minus({ days: DEFAULT_RANGE_DAYS });
  const normalizedTo = toDate;

  const query = client
    .from("observability_events")
    .select("id, created_at, booking_id, context")
    .eq("source", "capacity.selector")
    .eq("event_type", "capacity.selector.skipped")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", normalizedFrom.toUTC().toISO())
    .lte("created_at", normalizedTo.toUTC().toISO())
    .order("created_at", { ascending: true });

  const limit = options.limit ?? DEFAULT_LIMIT;
  const { data, error } = await query.limit(limit);

  if (error) {
    throw error;
  }

  const events = (data ?? []) as ObservabilityRow[];

  const totals = {
    total: 0,
    hard: 0,
    strategic: 0,
  };

  const hardReasons = new Map<string, number>();
  const strategicPenalties = new Map<OpsStrategicPenaltyKey, number>();
  const seriesBuckets = new Map<string, { hard: number; strategic: number }>();
  const strategicSamples: OpsStrategicSample[] = [];

  for (const event of events) {
    const timestamp = DateTime.fromISO(event.created_at, { zone: "utc" });
    if (!timestamp.isValid) {
      continue;
    }

    const context = event.context ?? {};
    const skipReasonRaw = typeof context.skipReason === "string" ? context.skipReason : null;
    const penalties = extractPenaltiesFromContext(context);
    const classification = deriveClassification(context.rejectionClassification, skipReasonRaw, penalties);

    totals.total += 1;
    totals[classification] += 1;

    const bucketKey = toSeriesKey(timestamp, bucket);
    const bucketEntry = seriesBuckets.get(bucketKey) ?? { hard: 0, strategic: 0 };
    bucketEntry[classification] += 1;
    seriesBuckets.set(bucketKey, bucketEntry);

    if (classification === "hard") {
      const reasonKey = skipReasonRaw ?? "Unknown reason";
      hardReasons.set(reasonKey, (hardReasons.get(reasonKey) ?? 0) + 1);
      continue;
    }

    const dominant = penalties?.dominant ?? "unknown";
    strategicPenalties.set(dominant, (strategicPenalties.get(dominant) ?? 0) + 1);

    if (strategicSamples.length < 64) {
      strategicSamples.push({
        bookingId: event.booking_id,
        createdAt: timestamp.toUTC().toISO() ?? event.created_at,
        skipReason: skipReasonRaw,
        dominantPenalty: dominant,
        penalties: {
          slack: penalties?.slack ?? 0,
          scarcity: penalties?.scarcity ?? 0,
          futureConflict: penalties?.futureConflict ?? 0,
        },
        plannerConfig: normalizePlannerConfig(context.plannerConfig),
      });
    }
  }

  strategicSamples.sort(compareDescendingByDate);
  const trimmedSamples = strategicSamples.slice(0, 20);

  const total = totals.total;
  const hardCount = totals.hard;
  const strategicCount = totals.strategic;

  const summary = {
    total,
    hard: {
      count: hardCount,
      percent: total > 0 ? Number(((hardCount / total) * 100).toFixed(2)) : 0,
      topReasons: Array.from(hardReasons.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label, count })),
    },
    strategic: {
      count: strategicCount,
      percent: total > 0 ? Number(((strategicCount / total) * 100).toFixed(2)) : 0,
      topPenalties: Array.from(strategicPenalties.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([penalty, count]) => ({ penalty, count })),
    },
  };

  const series = Array.from(seriesBuckets.entries())
    .map(([bucketKey, value]) => ({ bucket: bucketKey, hard: value.hard, strategic: value.strategic }))
    .sort((a, b) => DateTime.fromISO(a.bucket).toMillis() - DateTime.fromISO(b.bucket).toMillis());

  return {
    restaurantId,
    range: {
      from: normalizedFrom.toUTC().toISO() ?? normalizedFrom.toISO() ?? normalizedFrom.toString(),
      to: normalizedTo.toUTC().toISO() ?? normalizedTo.toISO() ?? normalizedTo.toString(),
      bucket,
    },
    summary,
    series,
    strategicSamples: trimmedSamples,
  };
}
