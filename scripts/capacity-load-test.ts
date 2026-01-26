import { config as loadEnv } from "dotenv";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";

type Args = {
  restaurantId: string;
  iterations: number;
  concurrency: number;
  partySizes: number[];
  maxTables?: number;
};

type RunResult = {
  durationMs: number;
  plans: number;
  skippedTimeout: number;
  skippedAdjacency: number;
};

function loadEnvFiles() {
  const cwd = process.cwd();
  const candidates = [".env.local", ".env"];
  for (const filename of candidates) {
    const filepath = path.join(cwd, filename);
    if (fs.existsSync(filepath)) {
      loadEnv({ path: filepath, override: false });
    }
  }
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const getArg = (key: string): string | undefined => {
    const index = args.findIndex((arg) => arg === `--${key}`);
    if (index >= 0) {
      return args[index + 1];
    }
    return undefined;
  };

  const restaurantId = getArg("restaurant");
  if (!restaurantId) {
    throw new Error("Missing --restaurant <uuid>");
  }

  const iterations = Number(getArg("iterations") ?? "200");
  const concurrency = Number(getArg("concurrency") ?? "8");
  const partySizesRaw = getArg("party-sizes") ?? "2,4,6,8,10";
  const maxTablesArg = getArg("max-tables");
  const partySizes = partySizesRaw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    throw new Error("Invalid --iterations (must be > 0)");
  }
  if (!Number.isFinite(concurrency) || concurrency <= 0) {
    throw new Error("Invalid --concurrency (must be > 0)");
  }
  if (partySizes.length === 0) {
    throw new Error("Invalid --party-sizes (must include at least one positive number)");
  }

  return {
    restaurantId,
    iterations,
    concurrency,
    partySizes,
    maxTables: typeof maxTablesArg === "string" ? Number(maxTablesArg) : undefined,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

async function main() {
  loadEnvFiles();
  const args = parseArgs();

  const [
    { getSelectorScoringConfig, getYieldManagementScarcityWeight },
    { loadStrategicConfig },
    { loadTableScarcityScores },
    { buildScoredTablePlans },
    { getAllocatorKMax, isCombinationPlannerEnabled },
    { getTenantServiceSupabaseClient },
    { loadAdjacency, loadTablesForRestaurant },
    { resolveRequireAdjacency },
  ] = await Promise.all([
    import("@/server/capacity/policy"),
    import("@/server/capacity/strategic-config"),
    import("@/server/capacity/scarcity"),
    import("@/server/capacity/selector"),
    import("@/server/feature-flags"),
    import("@/server/supabase"),
    import("@/server/capacity/table-assignment/supabase"),
    import("@/server/capacity/table-assignment/availability"),
  ]);

  const supabase = getTenantServiceSupabaseClient(args.restaurantId);
  const tables = await loadTablesForRestaurant(args.restaurantId, supabase);
  if (tables.length === 0) {
    throw new Error("No tables found for restaurant");
  }

  const adjacency = await loadAdjacency(
    args.restaurantId,
    tables.map((table) => table.id),
    supabase,
  );

  const strategicConfig = await loadStrategicConfig({ restaurantId: args.restaurantId, client: supabase });
  const baseScoring = getSelectorScoringConfig(strategicConfig);
  const scoringConfig = {
    ...baseScoring,
    weights: {
      ...baseScoring.weights,
      scarcity: getYieldManagementScarcityWeight({ restaurantId: args.restaurantId }),
    },
  };

  const tableScarcityScores = await loadTableScarcityScores({
    restaurantId: args.restaurantId,
    tables,
    client: supabase,
  });

  const enableCombinations = isCombinationPlannerEnabled();
  const kMax = args.maxTables ?? getAllocatorKMax();

  const runs: RunResult[] = [];
  const totalRuns = args.iterations;
  let index = 0;

  const worker = async () => {
    while (index < totalRuns) {
      const runIndex = index;
      index += 1;
      const partySize = args.partySizes[runIndex % args.partySizes.length]!;
      const requireAdjacency = resolveRequireAdjacency(partySize);

      const start = performance.now();
      const result = buildScoredTablePlans({
        tables,
        partySize,
        adjacency,
        config: scoringConfig,
        enableCombinations,
        kMax,
        requireAdjacency,
        demandMultiplier: 1,
        tableScarcityScores,
      });
      const durationMs = performance.now() - start;

      runs.push({
        durationMs,
        plans: result.plans.length,
        skippedTimeout: result.diagnostics?.skipped?.timeout ?? 0,
        skippedAdjacency: result.diagnostics?.skipped?.adjacency_frontier ?? 0,
      });
    }
  };

  const workers = Array.from({ length: Math.min(args.concurrency, totalRuns) }, () => worker());
  await Promise.all(workers);

  const durations = runs.map((run) => run.durationMs);
  const totalPlans = runs.reduce((sum, run) => sum + run.plans, 0);
  const totalTimeouts = runs.reduce((sum, run) => sum + run.skippedTimeout, 0);
  const totalAdjacencySkips = runs.reduce((sum, run) => sum + run.skippedAdjacency, 0);

  console.log("Capacity load test complete");
  console.log(`restaurantId=${args.restaurantId}`);
  console.log(`runs=${runs.length} concurrency=${args.concurrency} partySizes=${args.partySizes.join(",")}`);
  console.log(`enableCombinations=${enableCombinations} kMax=${kMax}`);
  console.log(`plansAvg=${(totalPlans / runs.length).toFixed(2)} timeouts=${totalTimeouts} adjacencySkips=${totalAdjacencySkips}`);
  console.log(
    `p50=${percentile(durations, 50).toFixed(2)}ms p90=${percentile(durations, 90).toFixed(2)}ms p95=${percentile(durations, 95).toFixed(2)}ms p99=${percentile(durations, 99).toFixed(2)}ms max=${Math.max(...durations).toFixed(2)}ms`,
  );
}

main().catch((error) => {
  console.error("[capacity-load-test] failed", error);
  process.exit(1);
});
