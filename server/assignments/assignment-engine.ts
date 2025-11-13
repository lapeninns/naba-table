import { createManualHold, DEFAULT_HOLD_TTL_SECONDS, ManualSelectionInputError } from "@/server/capacity/table-assignment";
import { loadAdjacency } from "@/server/capacity/table-assignment/supabase";
import { getServiceSupabaseClient } from "@/server/supabase";


import { TableAvailabilityTracker } from "./availability-tracker";

import type {
  AssignmentAttempt,
  AssignmentContext,
  AssignmentPlan,
  AssignmentResult,
  AssignmentStrategy,
  AssignmentHold,
  BookingWithAssignmentState,
  TimeSlot,
} from "./types";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const ASSIGNMENT_ACTOR = "assignment_coordinator";
const DEFAULT_MAX_PLANS = 5;
const HISTORICAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type AssignmentEngineConfig = {
  maxPlansToTry?: number;
  holdTtlSeconds?: number;
  includePendingHolds?: boolean;
};

export type AssignmentEngineDependencies = {
  tracker?: TableAvailabilityTracker;
  supabase?: SupabaseClient<Database>;
};

export class SmartAssignmentEngine {
  private readonly tracker: TableAvailabilityTracker;
  private readonly supabase: SupabaseClient<Database>;
  private readonly strategies: AssignmentStrategy[];

  constructor(
    private readonly config: AssignmentEngineConfig = {},
    dependencies: AssignmentEngineDependencies = {},
  ) {
    this.supabase = dependencies.supabase ?? getServiceSupabaseClient();
    this.tracker = dependencies.tracker ?? new TableAvailabilityTracker(this.supabase);
    this.strategies = [
      optimalFitStrategy,
      adjacencyStrategy,
      zonePreferenceStrategy,
      loadBalancingStrategy,
      historicalStrategy,
    ];
  }

  async buildContext(booking: BookingWithAssignmentState, timeSlot: TimeSlot): Promise<AssignmentContext> {
    const availability = await this.tracker.getSnapshot(booking.restaurant_id, timeSlot, {
      includePending: this.config.includePendingHolds ?? true,
    });
    const adjacency = await loadAdjacency(
      booking.restaurant_id,
      availability.availableTables.map((table) => table.id),
      this.supabase,
    );
    return {
      booking,
      timeSlot,
      availability,
      adjacency,
      includePendingHolds: this.config.includePendingHolds ?? true,
    };
  }

  async findOptimalAssignment(context: AssignmentContext): Promise<AssignmentResult> {
    const candidates = await this.collectPlans(context);
    if (candidates.length === 0) {
      return { success: false, reason: "No viable plans", attempts: [] };
    }

    const attempts = await this.rankPlans(context, candidates);
    const limit = Math.max(1, this.config.maxPlansToTry ?? DEFAULT_MAX_PLANS);
    const sliced = attempts.slice(0, limit);
    const tried: AssignmentAttempt[] = [];

    for (const attempt of sliced) {
      const hold = await this.attemptHold(context.booking, attempt.plan);
      tried.push(attempt);
      if (hold) {
        return {
          success: true,
          assignment: hold,
          strategy: attempt.strategy,
          plan: attempt.plan,
          score: attempt.score,
          attempts: [...tried],
        };
      }
    }

    return { success: false, reason: "No viable assignments found", attempts: tried };
  }

  private async collectPlans(
    context: AssignmentContext,
  ): Promise<Array<{ plan: AssignmentPlan; strategy: AssignmentStrategy }>> {
    const plans = new Map<string, { plan: AssignmentPlan; strategy: AssignmentStrategy }>();
    for (const strategy of this.strategies) {
      const evaluated = await strategy.evaluate(context);
      for (const plan of evaluated) {
        if (!plan.tableIds?.length) {
          continue;
        }
        const signature = plan.tableIds.slice().sort().join(":");
        const existing = plans.get(signature);
        if (!existing || existing.strategy.priority < strategy.priority) {
          plans.set(signature, { plan, strategy });
        }
      }
    }
    return Array.from(plans.values());
  }

  private async rankPlans(
    context: AssignmentContext,
    candidates: Array<{ plan: AssignmentPlan; strategy: AssignmentStrategy }>,
  ): Promise<AssignmentAttempt[]> {
    const attempts: AssignmentAttempt[] = [];
    for (const candidate of candidates) {
      const successRate = await this.getHistoricalSuccessRate(candidate.strategy.name);
      const score = this.scorePlan(candidate.plan, context, candidate.strategy.priority, successRate);
      attempts.push({ plan: candidate.plan, strategy: candidate.strategy.name, score });
    }
    attempts.sort((a, b) => b.score - a.score);
    return attempts;
  }

  private async attemptHold(
    booking: BookingWithAssignmentState,
    plan: AssignmentPlan,
  ): Promise<AssignmentHold | null> {
    try {
      const result = await createManualHold({
        bookingId: booking.id,
        tableIds: plan.tableIds,
        requireAdjacency: plan.tables.length > 1 ? plan.adjacencySatisfied : false,
        createdBy: ASSIGNMENT_ACTOR,
        holdTtlSeconds: this.config.holdTtlSeconds ?? DEFAULT_HOLD_TTL_SECONDS,
      });

      if (result.hold && result.validation.ok) {
        return {
          holdId: result.hold.id,
          expiresAt: result.hold.expiresAt,
          tableIds: plan.tableIds,
        };
      }
      return null;
    } catch (error) {
      if (error instanceof ManualSelectionInputError) {
        return null;
      }
      throw error;
    }
  }

  private scorePlan(
    plan: AssignmentPlan,
    context: AssignmentContext,
    strategyWeight: number,
    historicalSuccessRate: number,
  ): number {
    let score = Math.max(1, strategyWeight) * 100;
    const partySize = context.booking.party_size ?? 0;
    const capacityRatio = partySize > 0 ? plan.totalCapacity / partySize : 0;

    if (capacityRatio >= 1 && capacityRatio < 1.3) {
      score += 50;
    } else if (capacityRatio >= 1.3 && capacityRatio < 1.6) {
      score += 20;
    }

    if (plan.tables.length > 1 && plan.adjacencySatisfied) {
      score += 30;
    }

    score += historicalSuccessRate * 20;
    score -= plan.tables.length * 5;
    score -= plan.slack;

    return score;
  }

  private async getHistoricalSuccessRate(strategy: string): Promise<number> {
    const since = new Date(Date.now() - HISTORICAL_LOOKBACK_MS).toISOString();
    const { data } = await this.supabase
      .from("booking_assignment_attempts")
      .select("result")
      .eq("strategy", strategy)
      .gte("created_at", since)
      .limit(200);

    if (!Array.isArray(data) || data.length === 0) {
      return 0.5;
    }

    let successes = 0;
    for (const entry of data as Array<{ result: string }>) {
      if (entry.result === "success") {
        successes += 1;
      }
    }
    return successes / data.length;
  }
}

function generatePlans(
  context: AssignmentContext,
  options: {
    maxTables?: number;
    zoneId?: string | null;
    requireAdjacency?: boolean;
    tableSampleSize?: number;
    limit?: number;
  } = {},
): AssignmentPlan[] {
  const partySize = context.booking.party_size ?? 0;
  if (partySize <= 0) {
    return [];
  }
  const maxTables = Math.max(1, options.maxTables ?? 3);
  const tableSample = Math.max(1, options.tableSampleSize ?? 18);
  const limit = Math.max(1, options.limit ?? 25);

  const candidates = context.availability.availableTables
    .filter((table) => (options.zoneId ? table.zoneId === options.zoneId : true))
    .slice(0, tableSample);

  const plans: AssignmentPlan[] = [];
  const picked: Table[] = [];

  function dfs(startIndex: number): void {
    if (plans.length >= limit) {
      return;
    }
    if (picked.length > 0) {
      const plan = buildPlan(picked, partySize, context.adjacency);
      if (plan && (!options.requireAdjacency || plan.adjacencySatisfied)) {
        plans.push(plan);
      }
    }
    if (picked.length >= maxTables) {
      return;
    }
    for (let i = startIndex; i < candidates.length; i += 1) {
      picked.push(candidates[i]!);
      dfs(i + 1);
      picked.pop();
      if (plans.length >= limit) {
        break;
      }
    }
  }

  dfs(0);
  return plans;
}

type Table = AssignmentContext["availability"]["availableTables"][number];

function buildPlan(tables: Table[], partySize: number, adjacency: Map<string, Set<string>>): AssignmentPlan | null {
  const totalCapacity = tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
  if (totalCapacity < partySize) {
    return null;
  }
  const slack = totalCapacity - partySize;
  const adjacencySatisfied = tables.length <= 1 ? true : areTablesAdjacent(tables, adjacency);
  const zoneId = computeZoneId(tables);
  return {
    id: `plan:${tables
      .map((table) => table.id)
      .slice()
      .sort()
      .join(":")}`,
    tableIds: tables.map((table) => table.id),
    tables: [...tables],
    totalCapacity,
    slack,
    adjacencySatisfied,
    zoneId,
    metadata: {
      tableCount: tables.length,
    },
  };
}

function areTablesAdjacent(tables: Table[], adjacency: Map<string, Set<string>>): boolean {
  if (tables.length <= 1) {
    return true;
  }
  const targetIds = tables.map((table) => table.id);
  const queue = [targetIds[0]!];
  const visited = new Set<string>([targetIds[0]!]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!targetIds.includes(neighbor)) {
        continue;
      }
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }
  return visited.size === targetIds.length;
}

function computeZoneId(tables: Table[]): string | null {
  if (tables.length === 0) return null;
  const firstZone = tables[0]?.zoneId ?? null;
  if (!firstZone) return null;
  for (const table of tables) {
    if (table.zoneId !== firstZone) {
      return null;
    }
  }
  return firstZone;
}

const optimalFitStrategy: AssignmentStrategy = {
  name: "optimal_fit",
  priority: 5,
  async evaluate(context) {
    return generatePlans(context, { maxTables: 3, limit: 20 });
  },
};

const adjacencyStrategy: AssignmentStrategy = {
  name: "adjacency",
  priority: 4,
  async evaluate(context) {
    return generatePlans(context, { maxTables: 3, requireAdjacency: true, limit: 15 });
  },
};

const zonePreferenceStrategy: AssignmentStrategy = {
  name: "zone_preference",
  priority: 4,
  async evaluate(context) {
    const zoneId = context.booking.assigned_zone_id ?? pickDominantZone(context);
    if (!zoneId) {
      return [];
    }
    return generatePlans(context, { zoneId, maxTables: 3, limit: 12 });
  },
};

const loadBalancingStrategy: AssignmentStrategy = {
  name: "load_balancing",
  priority: 3,
  async evaluate(context) {
    const zoneId = pickUnderutilizedZone(context);
    if (!zoneId) {
      return [];
    }
    return generatePlans(context, { zoneId, maxTables: 2, limit: 10 });
  },
};

const historicalStrategy: AssignmentStrategy = {
  name: "historical_success",
  priority: 2,
  async evaluate(context) {
    return generatePlans(context, { maxTables: 2, limit: 8 });
  },
};

function pickDominantZone(context: AssignmentContext): string | null {
  const entries = Object.entries(context.availability.zones);
  if (entries.length === 0) {
    return null;
  }
  entries.sort((a, b) => b[1].capacity - a[1].capacity);
  const [zone] = entries[0] ?? [];
  if (!zone || zone === "unassigned") {
    return null;
  }
  return zone;
}

function pickUnderutilizedZone(context: AssignmentContext): string | null {
  const entries = Object.entries(context.availability.zones);
  if (entries.length === 0) {
    return null;
  }
  entries.sort((a, b) => a[1].available - b[1].available);
  const [zone] = entries[entries.length - 1] ?? [];
  if (!zone || zone === "unassigned") {
    return null;
  }
  return zone;
}
