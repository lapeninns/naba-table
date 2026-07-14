import { describe, expect, it } from 'vitest';

import { getSelectorScoringConfig } from '@/server/capacity/policy';
import { buildScoredTablePlans, type RankedTablePlan } from '@/server/capacity/selector';
import {
  createAvailabilityBitset,
  isWindowFree,
  markWindow,
} from '@/server/capacity/planner/bitset';
import { getAllocatorKMax, getSelectorPlannerLimits } from '@/server/runtime-policy';

import type { Table } from '@/server/capacity/table-assignment/types';

/**
 * STRESS / PROPERTY SUITE for the table-assignment planner.
 *
 * Drives the REAL planner (buildScoredTablePlans) + bitset over thousands of
 * randomised, in-memory floor plans (no live DB) and asserts the correctness
 * invariants the prior fixes established. Deterministic via a seeded RNG: a
 * failing case prints its seed so it reproduces exactly. A fault-injection block
 * proves the invariant checker is non-vacuous.
 */

// ---- seeded RNG (mulberry32) ----
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];

// ---- generators ----
function makeTable(
  id: string,
  capacity: number,
  zoneId: string | null,
  mobility: 'movable' | 'fixed',
): Table {
  return {
    id,
    tableNumber: id,
    capacity,
    zoneId,
    status: 'available',
    active: true,
    zoneActive: true,
    mobility,
    category: null,
    seatingType: null,
    section: null,
    position: null,
    minPartySize: null,
    maxPartySize: null,
  };
}

const CAPS = [1, 2, 2, 4, 4, 6, 8];

function randomFloorPlan(
  r: () => number,
  opts: { count: number; zones: (string | null)[]; movableBias?: number },
): Table[] {
  const movableBias = opts.movableBias ?? 0.7;
  return Array.from({ length: opts.count }, (_v, i) =>
    makeTable(
      `t${i}`,
      pick(r, CAPS),
      pick(r, opts.zones),
      r() < movableBias ? 'movable' : 'fixed',
    ),
  );
}

// Symmetric adjacency (planner reads adjacency.get(id) both directions).
function symmetric(edges: [string, string][]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!m.has(a)) m.set(a, new Set());
    m.get(a)!.add(b);
  };
  for (const [a, b] of edges) {
    add(a, b);
    add(b, a);
  }
  return m;
}
function adjacencyChain(ids: string[]) {
  const e: [string, string][] = [];
  for (let i = 1; i < ids.length; i += 1) e.push([ids[i - 1], ids[i]]);
  return symmetric(e);
}
function adjacencyRandom(r: () => number, ids: string[], density: number) {
  const e: [string, string][] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      if (r() < density) e.push([ids[i], ids[j]]);
    }
  }
  return symmetric(e);
}

// ---- invariant checker (shared by property suite + fault-injection) ----
function planViolations(
  plan: RankedTablePlan,
  partySize: number,
  maxOverage: number,
  kMax: number,
  adjacency: Map<string, Set<string>>,
  requireAdjacency: boolean,
): string[] {
  const v: string[] = [];
  const ids = plan.tables.map((t) => t.id);

  if (new Set(ids).size !== ids.length) v.push(`duplicate tables [${ids.join(',')}]`);
  if (ids.length < 1) v.push('empty plan');
  if (ids.length > kMax) v.push(`tableCount ${ids.length} > kMax ${kMax}`);
  if (plan.totalCapacity < partySize) v.push(`capacity ${plan.totalCapacity} < party ${partySize}`);
  if (plan.totalCapacity - partySize > maxOverage) {
    v.push(`overage ${plan.totalCapacity - partySize} > maxOverage ${maxOverage}`);
  }
  if (plan.metrics.overage !== plan.totalCapacity - partySize) {
    v.push(`metrics.overage ${plan.metrics.overage} != ${plan.totalCapacity - partySize}`);
  }
  if (plan.metrics.tableCount !== ids.length) {
    v.push(`metrics.tableCount ${plan.metrics.tableCount} != ${ids.length}`);
  }
  // zone-lock: all one non-null zone, or all zoneless
  const zones = new Set(plan.tables.map((t) => t.zoneId ?? '∅'));
  if (zones.size > 1) v.push(`mixed zones {${[...zones].join(',')}}`);
  // adjacency-connected merge when adjacency is required
  if (requireAdjacency && ids.length > 1 && !isConnected(ids, adjacency)) {
    v.push(`merge not adjacency-connected [${ids.join(',')}]`);
  }
  return v;
}

function isConnected(ids: string[], adjacency: Map<string, Set<string>>): boolean {
  const set = new Set(ids);
  const seen = new Set<string>([ids[0]]);
  const queue = [ids[0]];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (set.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === set.size;
}

const CONFIG = getSelectorScoringConfig();
const KMAX = getAllocatorKMax();
const LIMITS = getSelectorPlannerLimits();

function runPlanner(
  tables: Table[],
  partySize: number,
  adjacency: Map<string, Set<string>>,
  allowCapacityOverflow = false,
) {
  return buildScoredTablePlans({
    tables,
    partySize,
    adjacency,
    config: CONFIG,
    enableCombinations: true,
    kMax: KMAX,
    maxPlansPerSlack: LIMITS.maxPlansPerSlack,
    maxCombinationEvaluations: LIMITS.maxCombinationEvaluations,
    enumerationTimeoutMs: LIMITS.enumerationTimeoutMs,
    requireAdjacency: true,
    allowCapacityOverflow,
  });
}

describe('STRESS: planner invariants over randomised floor plans', () => {
  it('every returned plan satisfies all correctness invariants (2000 cases)', () => {
    let cases = 0;
    let seatable = 0;
    for (let seed = 1; seed <= 2000; seed += 1) {
      const r = mulberry32(seed);
      const count = int(r, 1, 40);
      const zoneMode = pick(r, ['multi', 'single', 'allnull']);
      const zones =
        zoneMode === 'allnull'
          ? [null]
          : zoneMode === 'single'
            ? ['z1']
            : ['z1', 'z2', 'z3'];
      const tables = randomFloorPlan(r, { count, zones });
      const ids = tables.map((t) => t.id);
      const adjacency = pick(r, [
        adjacencyChain(ids),
        adjacencyRandom(r, ids, 0.25),
        adjacencyRandom(r, ids, 0.6),
        new Map<string, Set<string>>(),
      ]);
      const party = int(r, 1, 16);

      const result = runPlanner(tables, party, adjacency);
      cases += 1;
      if (result.plans.length > 0) seatable += 1;

      for (const plan of result.plans) {
        const violations = planViolations(plan, party, CONFIG.maxOverage, KMAX, adjacency, true);
        if (violations.length > 0) {
          throw new Error(
            `INVARIANT VIOLATION (seed=${seed}, party=${party}, tables=${count}): ` +
              `${violations.join('; ')} | plan=[${plan.tables
                .map((t) => `${t.id}/${t.capacity}/${t.zoneId ?? '∅'}`)
                .join(',')}]`,
          );
        }
      }

      // ranking monotonic on the primary key (overage ascending)
      for (let i = 1; i < result.plans.length; i += 1) {
        expect(result.plans[i].metrics.overage).toBeGreaterThanOrEqual(
          result.plans[i - 1].metrics.overage,
        );
      }

      // determinism: same input => identical chosen plan
      if (result.plans.length > 0) {
        const again = runPlanner(tables, party, adjacency);
        expect(again.plans[0]?.tableKey).toBe(result.plans[0].tableKey);
      }
    }
    expect(cases).toBe(2000);
    // sanity: the randomised corpus actually exercises seatable outcomes
    expect(seatable).toBeGreaterThan(1000);
  }, 15_000);
});

describe('STRESS: overflow fallback still honors maxOverage (#2, fuzzed)', () => {
  it('no plan exceeds maxOverage even with allowCapacityOverflow=true (1500 cases)', () => {
    let overflowSeatable = 0;
    for (let seed = 1; seed <= 1500; seed += 1) {
      const r = mulberry32(seed * 13 + 5);
      const count = int(r, 1, 25);
      const tables = randomFloorPlan(r, { count, zones: ['z1', 'z2'], movableBias: 0.85 });
      const ids = tables.map((t) => t.id);
      const adjacency = pick(r, [adjacencyChain(ids), adjacencyRandom(r, ids, 0.4)]);
      const party = int(r, 1, 14);

      const res = runPlanner(tables, party, adjacency, /* allowCapacityOverflow */ true);
      if (res.plans.length > 0) overflowSeatable += 1;
      for (const plan of res.plans) {
        if (plan.totalCapacity - party > CONFIG.maxOverage) {
          throw new Error(
            `OVERFLOW maxOverage VIOLATION (seed=${seed}, party=${party}): overage ` +
              `${plan.totalCapacity - party} > ${CONFIG.maxOverage} | plan=[${plan.tables
                .map((t) => `${t.id}/${t.capacity}`)
                .join(',')}]`,
          );
        }
      }
    }
    expect(overflowSeatable).toBeGreaterThan(500);
  });
});

describe('STRESS: adversarial / pathological inputs never crash', () => {
  const adj = new Map<string, Set<string>>();
  it('empty inventory => no plans, no throw', () => {
    expect(() => runPlanner([], 4, adj)).not.toThrow();
    expect(runPlanner([], 4, adj).plans).toHaveLength(0);
  });
  it('party larger than total capacity => not seatable, no throw', () => {
    const tables = [makeTable('t0', 2, 'z1', 'movable')];
    expect(runPlanner(tables, 1000, adjacencyChain(['t0'])).plans).toHaveLength(0);
  });
  it('a fixed table too small for the party (cannot merge) => not seatable', () => {
    // Status filtering (out_of_service/inactive) is filterAvailableTables's job; the
    // planner operates on pre-filtered tables. The planner's OWN guard: a fixed table
    // below party size is neither a valid single seat nor a merge candidate.
    const tables = [makeTable('t0', 2, 'z1', 'fixed')];
    expect(runPlanner(tables, 6, adjacencyChain(['t0'])).plans).toHaveLength(0);
  });
  it('all-zoneless inventory can still merge (zone-lock allows the null group)', () => {
    const tables = [
      makeTable('t0', 4, null, 'movable'),
      makeTable('t1', 4, null, 'movable'),
    ];
    const res = runPlanner(tables, 7, adjacencyChain(['t0', 't1']));
    for (const plan of res.plans) {
      expect(planViolations(plan, 7, CONFIG.maxOverage, KMAX, adjacencyChain(['t0', 't1']), true)).toEqual(
        [],
      );
    }
  });
  it('huge sparse inventory with no adjacency => only single-table plans, bounded, fast', () => {
    const tables = Array.from({ length: 300 }, (_v, i) =>
      makeTable(`t${i}`, CAPS[i % CAPS.length], 'z1', 'movable'),
    );
    const t0 = performance.now();
    const res = runPlanner(tables, 9, new Map());
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(500);
    for (const plan of res.plans) expect(plan.tables.length).toBe(1);
  });
});

describe('STRESS: volume / scale (planner stays bounded)', () => {
  it('large inventories stay within time + invariant bounds', () => {
    for (const count of [100, 300, 600]) {
      const r = mulberry32(count);
      const tables = randomFloorPlan(r, { count, zones: ['z1', 'z2'] });
      const ids = tables.map((t) => t.id);
      const adjacency = adjacencyChain(ids);
      const t0 = performance.now();
      const res = runPlanner(tables, 10, adjacency);
      const ms = performance.now() - t0;
      expect(ms).toBeLessThan(750);
      for (const plan of res.plans) {
        expect(
          planViolations(plan, 10, CONFIG.maxOverage, KMAX, adjacency, true),
        ).toEqual([]);
      }
    }
  });
});

describe('STRESS: bitset no-double-book primitive', () => {
  it('overlapping windows always conflict; disjoint windows never do (1000 cases)', () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const r = mulberry32(seed * 7 + 1);
      const SLOT = 5 * 60 * 1000;
      const aStart = int(r, 0, 200) * SLOT;
      const aLen = int(r, 1, 12) * SLOT;
      const aEnd = aStart + aLen;
      const bitset = createAvailabilityBitset([{ start: aStart, end: aEnd }]);

      // A probe that genuinely overlaps [aStart, aEnd) must be busy.
      const overlapStart = aStart + int(r, 0, Math.max(0, aLen / SLOT - 1)) * SLOT;
      expect(isWindowFree(bitset, overlapStart, overlapStart + SLOT)).toBe(false);

      // A probe strictly after the window must be free.
      expect(isWindowFree(bitset, aEnd, aEnd + SLOT)).toBe(true);
      // A probe strictly before must be free.
      if (aStart >= SLOT) {
        expect(isWindowFree(bitset, aStart - SLOT, aStart)).toBe(true);
      }
    }
  });

  it('sequential greedy fill never reuses a table within an overlapping window', () => {
    const SLOT = 5 * 60 * 1000;
    const perTable = new Map<string, ReturnType<typeof createAvailabilityBitset>>();
    const tables = ['A', 'B', 'C'];
    for (const t of tables) perTable.set(t, createAvailabilityBitset());
    const r = mulberry32(99);
    for (let i = 0; i < 500; i += 1) {
      const start = int(r, 0, 250) * SLOT;
      const end = start + int(r, 1, 18) * SLOT;
      // assign to the first table that is free for [start,end)
      const free = tables.find((t) => isWindowFree(perTable.get(t)!, start, end));
      if (!free) continue;
      // double-check the no-overlap property before committing
      expect(isWindowFree(perTable.get(free)!, start, end)).toBe(true);
      markWindow(perTable.get(free)!, start, end);
      // immediately re-probe: the same window must now be busy on that table
      expect(isWindowFree(perTable.get(free)!, start, end)).toBe(false);
    }
  });
});

describe('STRESS: fault-injection (the invariant checker is non-vacuous)', () => {
  const adj = adjacencyChain(['t0', 't1']);
  const tablesOf = (ids: string[]) =>
    ids.map((id, i) => makeTable(id, 6, i === 0 ? 'z1' : 'z2', 'movable'));

  function fakePlan(ids: string[], totalCapacity: number): RankedTablePlan {
    return {
      tables: tablesOf(ids),
      totalCapacity,
      slack: totalCapacity - 2,
      metrics: {
        overage: totalCapacity - 2,
        tableCount: ids.length,
        fragmentation: 0,
        zoneBalance: 0,
        adjacencyCost: 0,
        scarcityScore: 0,
      },
      score: 0,
      tableKey: ids.join('|'),
      adjacencyStatus: 'pairwise',
      scoreBreakdown: {
        slackPenalty: 0,
        demandMultiplier: 1,
        scarcityPenalty: 0,
        combinationPenalty: 0,
        structuralPenalty: 0,
        futureConflictPenalty: 0,
        total: 0,
      },
    };
  }

  it('flags an over-maxOverage plan', () => {
    // party 2, capacity 12 => overage 10 >> maxOverage(4)
    const v = planViolations(fakePlan(['t0'], 12), 2, CONFIG.maxOverage, KMAX, adj, true);
    expect(v.some((m) => m.includes('maxOverage'))).toBe(true);
  });
  it('flags a mixed-zone merge', () => {
    const v = planViolations(fakePlan(['t0', 't1'], 6), 4, CONFIG.maxOverage, KMAX, adj, true);
    expect(v.some((m) => m.includes('mixed zones'))).toBe(true);
  });
  it('flags a non-adjacency-connected merge', () => {
    const v = planViolations(fakePlan(['t0', 't1'], 6), 4, CONFIG.maxOverage, KMAX, new Map(), true);
    expect(v.some((m) => m.includes('not adjacency-connected'))).toBe(true);
  });
});
