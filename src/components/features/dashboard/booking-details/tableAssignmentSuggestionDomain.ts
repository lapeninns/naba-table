import type { ManualAssignmentTable } from '@/services/ops/bookings';

type ScoredAssignmentTable = {
  table: ManualAssignmentTable;
  score: number;
  fit: 'exact' | 'comfort' | 'large' | 'undersized';
  overage: number;
};

const OVERAGE_WEIGHT = 1.0;
const SCARCITY_WEIGHT = 0.5;
const EXACT_FIT_BONUS = -2.0;

export function suggestAssignmentTables({
  assignedTableIds,
  conflictedTableIds,
  partySize,
  tables,
}: {
  assignedTableIds: Set<string>;
  conflictedTableIds: Set<string>;
  partySize: number;
  tables: ManualAssignmentTable[];
}): ManualAssignmentTable[] {
  const candidates = tables.filter(
    (table) =>
      table.active &&
      table.status === 'available' &&
      !conflictedTableIds.has(table.id) &&
      !assignedTableIds.has(table.id),
  );

  if (candidates.length === 0) return [];

  const capacityCounts = buildCapacityCounts(candidates);
  const totalTables = candidates.length;
  const scarcityScores = new Map<string, number>();
  for (const table of candidates) {
    const capacity = table.capacity ?? 0;
    const count = capacityCounts.get(capacity) ?? 1;
    scarcityScores.set(table.id, count > 0 ? 1 / count : 0);
  }

  return candidates
    .flatMap((table): ScoredAssignmentTable[] => {
      const scored = scoreAssignmentTable({
        partySize,
        scarcity: scarcityScores.get(table.id) ?? 0,
        table,
        totalTables,
      });

      return scored ? [scored] : [];
    })
    .sort(compareScoredAssignmentTables)
    .slice(0, 8)
    .map((scored) => scored.table);
}

function buildCapacityCounts(tables: ManualAssignmentTable[]): Map<number, number> {
  const capacityCounts = new Map<number, number>();
  for (const table of tables) {
    const capacity = table.capacity ?? 0;
    capacityCounts.set(capacity, (capacityCounts.get(capacity) ?? 0) + 1);
  }
  return capacityCounts;
}

function scoreAssignmentTable({
  partySize,
  scarcity,
  table,
  totalTables,
}: {
  partySize: number;
  scarcity: number;
  table: ManualAssignmentTable;
  totalTables: number;
}): ScoredAssignmentTable | null {
  const capacity = table.capacity ?? 0;
  const minPartySize = table.minPartySize ?? 1;
  const maxPartySize = table.maxPartySize ?? Infinity;

  if (partySize < minPartySize) return null;
  if (maxPartySize !== null && maxPartySize > 0 && partySize > maxPartySize) return null;

  const overage = capacity - partySize;
  const fit = getAssignmentTableFit(overage);
  if (fit === 'undersized') return null;

  let score = 0;
  score += overage * OVERAGE_WEIGHT;
  score += scarcity * SCARCITY_WEIGHT * (totalTables > 1 ? 1 : 0);
  if (fit === 'exact') score += EXACT_FIT_BONUS;

  return {
    table,
    score,
    fit,
    overage,
  };
}

function getAssignmentTableFit(overage: number): ScoredAssignmentTable['fit'] {
  if (overage === 0) return 'exact';
  if (overage > 0 && overage <= 2) return 'comfort';
  if (overage > 2) return 'large';
  return 'undersized';
}

function compareScoredAssignmentTables(
  first: ScoredAssignmentTable,
  second: ScoredAssignmentTable,
): number {
  if (first.score !== second.score) return first.score - second.score;
  if (first.fit === 'exact' && second.fit !== 'exact') return -1;
  if (second.fit === 'exact' && first.fit !== 'exact') return 1;
  if (first.overage !== second.overage) return first.overage - second.overage;
  return (first.table.tableNumber ?? '').localeCompare(second.table.tableNumber ?? '');
}
