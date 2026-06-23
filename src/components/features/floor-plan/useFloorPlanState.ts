'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useFloorPlanActions } from '@/hooks/ops/useFloorPlanActions';
import { useFloorPlanData } from '@/hooks/ops/useFloorPlanData';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useTableLayoutMutation } from '@/hooks/ops/useTableLayoutMutation';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import { computeJoinGroups } from './domain/joins';
import { buildLayout, percentToRaw } from './domain/layout';
import { resolveTableState } from './domain/serviceState';
import { toMs } from './domain/timeSelection';
import { SERVICE_STATE_META, SERVICE_STATE_ORDER } from './domain/types';
import { computeZones } from './domain/zones';

import type {
  FloorPlanTable,
  NormalizedPosition,
  RawPosition,
  ResolvedTableState,
  ServiceState,
  ServiceStateMeta,
} from './domain/types';
import type { ZoneRegion } from './domain/zones';

const NOW_TICK_MS = 30_000;
const PLAY_STEP_MS = 5 * 60_000;
const PLAY_INTERVAL_MS = 220;
const FALLBACK_BACK_MS = 2 * 60 * 60_000;
const FALLBACK_FWD_MS = 3 * 60 * 60_000;

export type FloorPlanNode = {
  table: FloorPlanTable;
  position: NormalizedPosition | null;
  resolved: ResolvedTableState;
  isSelected: boolean;
  dimmed: boolean;
};

export type LegendEntry = ServiceStateMeta & { state: ServiceState; count: number };

export type FloorPlanStats = {
  seatedCovers: number;
  bookedCovers: number;
  bookedTables: number;
  openTables: number;
  capacity: number;
  totalTables: number;
  zoneCount: number;
  occupancyPct: number;
};

export type UseFloorPlanStateOptions = { initialNowIso: string };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function useFloorPlanState({ initialNowIso }: UseFloorPlanStateOptions) {
  const membership = useOpsActiveMembership();
  const restaurantId = membership?.restaurantId ?? null;
  const canEdit = membership ? isRestaurantAdminRole(membership.role) : false;

  const restaurantDetails = useOpsRestaurantDetails(restaurantId);
  const timezone = restaurantDetails.data?.timezone ?? 'UTC';
  const date = useMemo(() => getTodayInTimezone(timezone), [timezone]);
  const venueName = restaurantDetails.data?.name ?? membership?.restaurantName ?? 'Floor plan';

  const data = useFloorPlanData({ restaurantId, date });
  const layoutMutation = useTableLayoutMutation(restaurantId);
  const actions = useFloorPlanActions({ restaurantId, date });

  // ── UI state ──────────────────────────────────────────────────────────
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<ServiceState | null>(null);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dragOverrides, setDragOverrides] = useState<Map<string, RawPosition>>(() => new Map());
  const [nowMs, setNowMs] = useState(() => {
    const parsed = Date.parse(initialNowIso);
    return Number.isNaN(parsed) ? 0 : parsed;
  });

  // Advance "now" while following live (not scrubbing).
  useEffect(() => {
    if (scrubMs !== null) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, [scrubMs]);

  // ── Time window ─────────────────────────────────────────────────────────
  const windowStartMs = toMs(data.window?.start) ?? nowMs - FALLBACK_BACK_MS;
  const windowEndMs = Math.max(
    windowStartMs + 60_000,
    toMs(data.window?.end) ?? nowMs + FALLBACK_FWD_MS,
  );
  // The server's final segment ends exactly at windowEnd (half-open intervals), so resolving
  // a table state AT windowEnd yields null and every table would blink to free. Keep the
  // playback head 1ms inside the window so the last segment always resolves.
  const headMaxMs = windowEndMs - 1;
  const liveNowMs = clamp(nowMs, windowStartMs, headMaxMs);
  const effectiveMs = scrubMs === null ? liveNowMs : clamp(scrubMs, windowStartMs, headMaxMs);
  const scrubbing = scrubMs !== null && Math.abs(effectiveMs - liveNowMs) > 60_000;

  // Play / pause: advance the scrub head through the service window.
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => {
      setScrubMs((current) => {
        const base = current ?? liveNowMs;
        const next = base + PLAY_STEP_MS;
        if (next >= windowEndMs) {
          setPlaying(false);
          return windowEndMs;
        }
        return next;
      });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, windowEndMs, liveNowMs]);

  // ── Layout + derived view models ─────────────────────────────────────────
  const tables = data.tables;
  const layout = useMemo(
    () => buildLayout(tables, dragOverrides.size > 0 ? dragOverrides : undefined),
    [tables, dragOverrides],
  );

  const nodes = useMemo<FloorPlanNode[]>(
    () =>
      tables.map((table) => {
        const resolved = resolveTableState(table, effectiveMs);
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
    [tables, effectiveMs, selectedTableId, spotlight, layout],
  );

  const zones = useMemo<ZoneRegion[]>(
    () => computeZones(tables, layout.positions, effectiveMs),
    [tables, layout.positions, effectiveMs],
  );

  const joinGroups = useMemo(() => computeJoinGroups(tables, effectiveMs), [tables, effectiveMs]);

  const legend = useMemo<LegendEntry[]>(() => {
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

  const stats = useMemo<FloorPlanStats>(() => {
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
    return {
      seatedCovers,
      bookedCovers,
      bookedTables,
      openTables,
      capacity,
      totalTables: nodes.length,
      zoneCount: zones.length,
      occupancyPct: capacity > 0 ? Math.round((seatedCovers / capacity) * 100) : 0,
    };
  }, [nodes, zones.length]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.table.id === selectedTableId) ?? null,
    [nodes, selectedTableId],
  );

  const joinGroupForSelected = useMemo(() => {
    if (!selectedNode) return null;
    return joinGroups.find((group) => group.tableIds.includes(selectedNode.table.id)) ?? null;
  }, [joinGroups, selectedNode]);

  // Candidate tables to combine the selected (party-holding) table with: free,
  // in-service tables in the same zone, not already part of its joined group.
  const joinTargetsForSelected = useMemo<{ id: string; label: string }[]>(() => {
    if (!selectedNode || !selectedNode.resolved.booking) return [];
    const selZone = selectedNode.table.zoneId ?? 'unzoned';
    const inGroup = new Set(joinGroupForSelected?.tableIds ?? [selectedNode.table.id]);
    return nodes
      .filter(
        (node) =>
          node.table.id !== selectedNode.table.id &&
          !inGroup.has(node.table.id) &&
          (node.table.zoneId ?? 'unzoned') === selZone &&
          node.resolved.state === 'free' &&
          !node.resolved.outOfService,
      )
      .slice(0, 4)
      .map((node) => ({ id: node.table.id, label: `Join ${node.table.tableNumber}` }));
  }, [selectedNode, nodes, joinGroupForSelected]);

  // ── Actions ───────────────────────────────────────────────────────────
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

  const setScrub = useCallback((ms: number) => {
    setPlaying(false);
    setScrubMs(ms);
  }, []);
  const backToNow = useCallback(() => {
    setPlaying(false);
    setScrubMs(null);
  }, []);
  const togglePlay = useCallback(() => setPlaying((value) => !value), []);

  const previewDrag = useCallback(
    (tableId: string, xPercent: number, yPercent: number, rotation = 0) => {
      const raw = percentToRaw(
        layout.bounds,
        clamp(xPercent, 0, 100),
        clamp(yPercent, 0, 100),
        rotation,
      );
      setDragOverrides((current) => {
        const next = new Map(current);
        next.set(tableId, raw);
        return next;
      });
    },
    [layout.bounds],
  );

  const commitDrag = useCallback(
    (tableId: string) => {
      const raw = dragOverrides.get(tableId);
      if (!raw) return;
      layoutMutation.mutate(
        { tableId, position: raw },
        {
          onSettled: () =>
            setDragOverrides((current) => {
              const next = new Map(current);
              next.delete(tableId);
              return next;
            }),
        },
      );
    },
    [dragOverrides, layoutMutation],
  );

  return {
    // identity / status
    restaurantId,
    venueName,
    timezone,
    date,
    canEdit,
    isLoading: data.isLoading,
    isError: data.isError,
    error: data.error,
    isEmpty: !data.isLoading && tables.length === 0,
    seeded: layout.seeded,
    refetch: data.refetch,

    // derived view models
    nodes,
    zones,
    joinGroups,
    legend,
    stats,
    selectedNode,
    joinGroupForSelected,
    joinTargetsForSelected,
    bounds: layout.bounds,

    // selection / filter
    selectTable,
    clearSelection,
    spotlight,
    toggleSpotlight,
    clearSpotlight,

    // time
    windowStartMs,
    windowEndMs,
    effectiveMs,
    liveNowMs,
    scrubbing,
    playing,
    setScrub,
    backToNow,
    togglePlay,

    // drag (admins can always rearrange movable tables — no edit-mode toggle)
    previewDrag,
    commitDrag,
    isPersistingLayout: layoutMutation.isPending,

    // booking actions
    seatParty: actions.seatParty,
    clearTable: actions.clearTable,
    markNoShowParty: actions.markNoShowParty,
    splitTable: actions.splitTable,
    joinTables: actions.joinTables,
    isSeating: actions.isSeating,
    isClearing: actions.isClearing,
  };
}

export type FloorPlanState = ReturnType<typeof useFloorPlanState>;
