'use client';

import { useCallback, useMemo, useState } from 'react';

import { buildLayout } from '@/components/features/floor-plan/domain/layout';
import { SERVICE_STATE_META, SERVICE_STATE_ORDER } from '@/components/features/floor-plan/domain/types';
import { FloorPlanShell } from '@/components/features/floor-plan/FloorPlanShell';
import { formatClock } from '@/components/features/floor-plan/format';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';

import {
  EFFECTIVE_MS,
  JOIN_GROUPS,
  MOCK_TABLES,
  RESOLVED_BY_ID,
  TIMEZONE,
  VENUE_NAME,
  WINDOW_END_MS,
  WINDOW_START_MS,
  ZONES,
} from './mockFloorPlan';

import type { ServiceState } from '@/components/features/floor-plan/domain/types';
import type { FloorPlanNode, FloorPlanState } from '@/components/features/floor-plan/useFloorPlanState';

/**
 * Dev-only harness: mounts the real FloorPlanShell with hand-laid mock data so the
 * auth-gated floor plan can be audited locally (selection + status filter are live;
 * time-scrub/play and booking actions are inert no-ops). NOT shipped — `enforceDevOnly`.
 */
export function FloorPlanDevHarness() {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<ServiceState | null>(null);

  const layout = useMemo(() => buildLayout(MOCK_TABLES), []);

  const nodes = useMemo<FloorPlanNode[]>(
    () =>
      MOCK_TABLES.map((table) => {
        const resolved = RESOLVED_BY_ID[table.id];
        const isSelected = table.id === selectedTableId;
        const dimmed = Boolean(spotlight) && resolved.state !== spotlight && !isSelected;
        return {
          table,
          position: layout.positions.get(table.id) ?? null,
          resolved,
          isSelected,
          dimmed,
        };
      }),
    [layout, selectedTableId, spotlight],
  );

  const legend = useMemo(() => {
    const counts = new Map<ServiceState, number>();
    for (const node of nodes) {
      counts.set(node.resolved.state, (counts.get(node.resolved.state) ?? 0) + 1);
    }
    return SERVICE_STATE_ORDER.map((state) => ({
      state,
      ...SERVICE_STATE_META[state],
      count: counts.get(state) ?? 0,
    })).filter((entry) => entry.count > 0);
  }, [nodes]);

  const stats = useMemo(() => {
    let seatedCovers = 0;
    let bookedCovers = 0;
    let bookedTables = 0;
    let openTables = 0;
    let capacity = 0;
    for (const node of nodes) {
      capacity += node.table.capacity;
      const meta = SERVICE_STATE_META[node.resolved.state];
      if (meta.occupied && node.resolved.booking) seatedCovers += node.resolved.booking.partySize;
      if (meta.booked && node.resolved.booking) {
        bookedCovers += node.resolved.booking.partySize;
        bookedTables += 1;
      }
      if (node.resolved.state === 'free') openTables += 1;
    }
    const zoneCount = new Set(nodes.map((n) => n.table.zoneId)).size;
    return {
      seatedCovers,
      bookedCovers,
      bookedTables,
      openTables,
      capacity,
      totalTables: nodes.length,
      zoneCount,
      occupancyPct: capacity > 0 ? Math.round((seatedCovers / capacity) * 100) : 0,
    };
  }, [nodes]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.table.id === selectedTableId) ?? null,
    [nodes, selectedTableId],
  );

  const joinGroupForSelected = useMemo(() => {
    if (!selectedNode) return null;
    return JOIN_GROUPS.find((group) => group.tableIds.includes(selectedNode.table.id)) ?? null;
  }, [selectedNode]);

  const joinTargetsForSelected = useMemo(() => {
    if (!selectedNode || !selectedNode.resolved.booking) return [];
    const selZone = selectedNode.table.zoneId;
    const inGroup = new Set(joinGroupForSelected?.tableIds ?? [selectedNode.table.id]);
    return nodes
      .filter(
        (node) =>
          node.table.id !== selectedNode.table.id &&
          !inGroup.has(node.table.id) &&
          node.table.zoneId === selZone &&
          node.resolved.state === 'free',
      )
      .slice(0, 4)
      .map((node) => ({ id: node.table.id, label: `Join ${node.table.tableNumber}` }));
  }, [selectedNode, nodes, joinGroupForSelected]);

  const noop = useCallback(() => {}, []);
  const selectTable = useCallback(
    (id: string) => setSelectedTableId((current) => (current === id ? null : id)),
    [],
  );
  const clearSelection = useCallback(() => setSelectedTableId(null), []);
  const toggleSpotlight = useCallback(
    (state: ServiceState) => setSpotlight((current) => (current === state ? null : state)),
    [],
  );
  const clearSpotlight = useCallback(() => setSpotlight(null), []);

  const fp = {
    restaurantId: 'r-dev',
    venueName: VENUE_NAME,
    timezone: TIMEZONE,
    date: '2026-06-23',
    canEdit: true,
    isLoading: false,
    isError: false,
    error: null,
    isEmpty: false,
    seeded: false,
    refetch: noop,
    nodes,
    zones: ZONES,
    joinGroups: JOIN_GROUPS,
    legend,
    stats,
    selectedNode,
    joinGroupForSelected,
    joinTargetsForSelected,
    bounds: layout.bounds,
    selectTable,
    clearSelection,
    spotlight,
    toggleSpotlight,
    clearSpotlight,
    windowStartMs: WINDOW_START_MS,
    windowEndMs: WINDOW_END_MS,
    effectiveMs: EFFECTIVE_MS,
    liveNowMs: EFFECTIVE_MS,
    scrubbing: false,
    playing: false,
    setScrub: noop,
    backToNow: noop,
    togglePlay: noop,
    previewDrag: noop,
    commitDrag: noop,
    isPersistingLayout: false,
    seatParty: noop,
    clearTable: noop,
    markNoShowParty: noop,
    splitTable: noop,
    joinTables: noop,
    isSeating: false,
    isClearing: false,
  } as unknown as FloorPlanState;

  const clock = formatClock(EFFECTIVE_MS, TIMEZONE);

  return (
    <div data-theme="app" className="min-h-screen bg-background">
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <FloorPlanShell fp={fp} clock={clock} />
      </OpsPageShell>
    </div>
  );
}
