import { computePayloadChecksum } from '@/server/capacity/v2';

import { toIsoUtc } from './utils';

import type { ManualAssignmentContextHold, Table, BookingWindow } from './types';

export type ManualAssignmentContextVersions = {
  context: string;
  policy: string;
  window: string;
  flags: string;
  tables: string;
  adjacency: string;
  holds: string;
  assignments: string;
};

export function buildTableVersion(tables: Table[]) {
  const payload = tables
    .map((table) => ({
      id: table.id,
      zoneId: table.zoneId,
      capacity: table.capacity,
      mobility: table.mobility,
      active: table.active,
      category: table.category,
      seatingType: table.seatingType,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return computePayloadChecksum(payload);
}

export function buildAdjacencyVersion(adjacency: Map<string, Set<string>>) {
  const edges = Array.from(adjacency.entries())
    .map(([id, neighbors]) => ({
      id,
      neighbors: Array.from(neighbors).sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return computePayloadChecksum(edges);
}

export function buildFlagsVersion(flags: Record<string, unknown>) {
  return computePayloadChecksum(flags);
}

export function buildWindowVersion(window: BookingWindow) {
  return computePayloadChecksum({
    startAt: toIsoUtc(window.block.start),
    endAt: toIsoUtc(window.block.end),
  });
}

export function buildHoldsVersion(holds: ManualAssignmentContextHold[]) {
  const payload = holds
    .map((hold) => ({
      id: hold.id,
      tableIds: [...hold.tableIds].sort(),
      startAt: hold.startAt,
      endAt: hold.endAt,
      expiresAt: hold.expiresAt,
      bookingId: hold.bookingId,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return computePayloadChecksum(payload);
}

export function buildAssignmentsVersion(assignments: string[]) {
  return computePayloadChecksum(assignments.slice().sort());
}

export function buildManualAssignmentContextVersions({
  adjacency,
  assignments,
  flags,
  holds,
  policyVersion,
  tables,
  window,
}: {
  adjacency: Map<string, Set<string>>;
  assignments: string[];
  flags: Record<string, unknown>;
  holds: ManualAssignmentContextHold[];
  policyVersion: string;
  tables: Table[];
  window: BookingWindow;
}): ManualAssignmentContextVersions {
  const tableVersion = buildTableVersion(tables);
  const adjacencyVersion = buildAdjacencyVersion(adjacency);
  const holdsVersion = buildHoldsVersion(holds);
  const assignmentsVersion = buildAssignmentsVersion(assignments);
  const flagsVersion = buildFlagsVersion(flags);
  const windowVersion = buildWindowVersion(window);
  const contextVersion = computePayloadChecksum({
    holds: holdsVersion,
    assignments: assignmentsVersion,
    flags: flagsVersion,
    window: windowVersion,
    policy: policyVersion,
    adjacency: adjacencyVersion,
    tables: tableVersion,
  });

  return {
    context: contextVersion,
    policy: policyVersion,
    window: windowVersion,
    flags: flagsVersion,
    tables: tableVersion,
    adjacency: adjacencyVersion,
    holds: holdsVersion,
    assignments: assignmentsVersion,
  };
}
