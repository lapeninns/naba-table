import {
  evaluateAdjacency as evaluateAdjacencyGraph,
  isAdjacencySatisfied,
  summarizeAdjacencyStatus,
} from '@/server/capacity/adjacency';
import { getSelectorScoringConfig } from '@/server/capacity/policy';
import { deriveTableRules } from '@/server/capacity/table-rules';
import { getAllocatorAdjacencyMode, getManualAssignmentMaxSlack } from '@/server/runtime-policy';

import type {
  ManualAssignmentConflict,
  ManualSelectionCheck,
  ManualSelectionSummary,
  Table,
} from './types';
import type { HoldConflictInfo } from '@/server/capacity/holds';

const DEFAULT_MANUAL_SLACK_BUDGET = 4;
// Generous ceiling so a misconfigured runtime override cannot effectively DISABLE
// the slack check (a huge value would let any oversized selection pass). A slack of
// 24 already permits seating a party of 2 at a 26-top, so anything above this is a
// misconfiguration rather than intent.
const MAX_MANUAL_SLACK_BUDGET = DEFAULT_MANUAL_SLACK_BUDGET * 6;

/** Clamp a slack budget into a sane range: never negative (which would reject every
 * selection) and never unbounded (which would disable the check). (#12) */
function clampSlackBudget(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MANUAL_SLACK_BUDGET;
  }
  return Math.max(0, Math.min(MAX_MANUAL_SLACK_BUDGET, value));
}

export function findUnavailableTables(tables: Table[]): Table[] {
  return tables.filter((table) => {
    const outOfService =
      typeof table.status === 'string' && table.status.toLowerCase() === 'out_of_service';
    return table.active === false || table.zoneActive === false || outOfService;
  });
}

export function resolveManualSlackBudget(): number {
  const override = getManualAssignmentMaxSlack();
  if (typeof override === 'number') {
    return clampSlackBudget(override);
  }
  const selectorConfig = getSelectorScoringConfig();
  return clampSlackBudget(selectorConfig.maxOverage ?? DEFAULT_MANUAL_SLACK_BUDGET);
}

export function buildManualChecks(params: {
  summary: ManualSelectionSummary;
  tables: Table[];
  requireAdjacency: boolean;
  adjacency: Map<string, Set<string>>;
  conflicts: ManualAssignmentConflict[];
  holdConflicts: HoldConflictInfo[];
  slackBudget: number;
}): ManualSelectionCheck[] {
  const checks: ManualSelectionCheck[] = [];
  const { summary, tables, adjacency, conflicts, holdConflicts, slackBudget } = params;

  const unavailableTables = findUnavailableTables(tables);
  checks.push({
    id: 'active',
    status: unavailableTables.length === 0 ? 'ok' : 'error',
    message:
      unavailableTables.length === 0
        ? 'Tables are available'
        : `Disabled or out-of-service tables: ${unavailableTables
            .map((table) => table.tableNumber || table.id)
            .join(', ')}`,
    details: {
      tableIds: unavailableTables.map((t) => t.id),
      statuses: unavailableTables.map((t) => t.status ?? null),
      zoneActive: unavailableTables.map((t) => t.zoneActive ?? null),
    },
  });

  checks.push({
    id: 'capacity',
    status: summary.totalCapacity >= summary.partySize ? 'ok' : 'error',
    message:
      summary.totalCapacity >= summary.partySize
        ? 'Capacity satisfied'
        : 'Selected tables do not meet requested party size',
    details: {
      totalCapacity: summary.totalCapacity,
      partySize: summary.partySize,
      slack: summary.slack,
    },
  });

  const slackOk = summary.slack <= slackBudget;
  checks.push({
    id: 'slack',
    status: slackOk ? 'ok' : 'error',
    message: slackOk
      ? `Slack within budget (${summary.slack} <= ${slackBudget})`
      : `Selection exceeds slack budget (allowed ${slackBudget}, actual ${summary.slack})`,
    details: {
      slack: summary.slack,
      allowedSlack: slackBudget,
    },
  });

  if (tables.length > 1 && summary.zoneId === null) {
    checks.push({
      id: 'zone',
      status: 'error',
      message: 'Tables must belong to the same zone for manual assignment',
    });
  } else {
    checks.push({
      id: 'zone',
      status: 'ok',
      message: `Zone ${summary.zoneId} validated`,
    });
  }

  if (tables.length > 1) {
    const allMovable = tables.every(
      (table) =>
        deriveTableRules({ capacity: table.capacity, mobility: table.mobility }).canBeMerged,
    );
    checks.push({
      id: 'movable',
      status: allMovable ? 'ok' : 'error',
      message: allMovable ? 'All tables are movable' : 'Merged assignments require movable tables',
    });
  } else {
    checks.push({
      id: 'movable',
      status: 'ok',
      message: 'Single table selection',
    });
  }

  if (tables.length > 1) {
    const adjacencyMode = getAllocatorAdjacencyMode();
    const evaluation = evaluateAdjacencyGraph(
      tables.map((table) => table.id),
      adjacency,
    );
    const adjacencyOk = isAdjacencySatisfied(evaluation, adjacencyMode);
    const failureMessage =
      adjacencyMode === 'pairwise'
        ? 'Tables must be adjacent to every other selected table'
        : adjacencyMode === 'neighbors'
          ? 'Tables must share a common neighbor/hub to be merged'
          : 'Tables must remain connected when adjacency enforcement is enabled';
    checks.push({
      id: 'adjacency',
      status: adjacencyOk ? 'ok' : 'error',
      message: adjacencyOk
        ? `Tables satisfy ${summarizeAdjacencyStatus(evaluation, tables.length)} adjacency`
        : failureMessage,
      details: {
        mode: adjacencyMode,
        status: summarizeAdjacencyStatus(evaluation, tables.length),
      },
    });
  } else {
    checks.push({
      id: 'adjacency',
      status: 'ok',
      message: 'Single table selection',
      details: {
        mode: 'off',
      },
    });
  }

  checks.push({
    id: 'conflict',
    status: conflicts.length === 0 && holdConflicts.length === 0 ? 'ok' : 'error',
    message:
      conflicts.length === 0 && holdConflicts.length === 0
        ? 'No conflicting assignments'
        : 'Existing assignments or holds conflict with selection',
    details: {
      conflicts,
      holdConflicts,
    },
  });

  checks.push({
    id: 'holds',
    status: holdConflicts.length === 0 ? 'ok' : 'error',
    message:
      holdConflicts.length === 0 ? 'No holds blocking selection' : 'Tables currently on hold',
    details: {
      holds: holdConflicts,
    },
  });

  return checks;
}
