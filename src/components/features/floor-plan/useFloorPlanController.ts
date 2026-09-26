'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useOpsActiveMembership, useOpsActiveRestaurantId } from '@/contexts/ops-session';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsFloorPlan } from '@/hooks/ops/useOpsFloorPlan';
import {
  toAssignmentError,
  useOpsFloorPlanAssignments,
} from '@/hooks/ops/useOpsFloorPlanAssignments';
import { useOpsFloorPlanLayoutSave } from '@/hooks/ops/useOpsFloorPlanLayout';
import {
  lifecycleErrorMessage,
  useOpsFloorPlanLifecycle,
} from '@/hooks/ops/useOpsFloorPlanLifecycle';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';

import { clampToZone, layoutFloorPlan } from './model/floorPlanLayout';
import {
  bestFitForBooking,
  bookingsNeedingTable,
  checkTableForBooking,
  computeTableStates,
  defaultService,
  defaultTimeFor,
  isLiveDate,
  isReadOnly,
  serviceCounts,
  serviceWindow,
  tableNumbers,
} from './model/floorPlanState';
import { MINUTE_MS, formatClock, todayInTimezone } from './model/floorPlanTime';
import { dirtyTableIds, layoutDraftReducer } from './model/layoutDraft';

import type { TableState } from './model/floorPlanState';
import type {
  FloorBooking,
  FloorPosition,
  FloorServiceFilter,
  FloorTable,
} from './model/floorPlanTypes';
import type { FloorPlanLifecycleAction } from '@/hooks/ops/useOpsFloorPlanLifecycle';

export type FloorView = 'plan' | 'timeline';
export type FloorMode = 'service' | 'arrange';
export type StatFilter = 'seated' | 'free' | 'awaiting' | 'over';
export type PickState = { bookingId: string; kind: 'assign' | 'move' };
export type ConfirmState =
  | { kind: 'no-show'; bookingId: string }
  | { kind: 'leave-arrange'; then: () => void }
  | { kind: 'reset-zone'; zoneId: string };

const CLOCK_TICK_MS = 30_000;
const FALLBACK_TIMEZONE = 'Europe/London';

function useClock(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * All state and actions for the floor plan page. Components stay presentational;
 * everything that talks to the server goes through the floor-plan hooks.
 */
export function useFloorPlanController({ initialDate }: { initialDate: string | null }) {
  const restaurantId = useOpsActiveRestaurantId();
  const membership = useOpsActiveMembership();
  const canArrange = membership ? isRestaurantAdminRole(membership.role) : false;
  const nowMs = useClock(CLOCK_TICK_MS);

  const [requestedDate, setRequestedDate] = useState<string | null>(initialDate);
  const data = useOpsFloorPlan({ restaurantId, date: requestedDate });
  const assignments = useOpsFloorPlanAssignments({ restaurantId, date: requestedDate });
  const lifecycle = useOpsFloorPlanLifecycle({ restaurantId, date: requestedDate });
  const layoutSave = useOpsFloorPlanLayoutSave(restaurantId);

  const snapshot = data.snapshot;
  const timezone = snapshot?.timezone ?? FALLBACK_TIMEZONE;
  const today = todayInTimezone(nowMs, timezone);
  const date = snapshot?.date ?? requestedDate ?? today;

  const [serviceChoice, setServiceChoice] = useState<FloorServiceFilter | null>(null);
  const [atMsChoice, setAtMsChoice] = useState<number | null>(null);
  const [view, setView] = useState<FloorView>('plan');
  const [listOn, setListOn] = useState(false);
  const [mode, setMode] = useState<FloorMode>('service');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [statFilter, setStatFilter] = useState<StatFilter | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [focusBookingId, setFocusBookingId] = useState<string | null>(null);
  const [pick, setPick] = useState<PickState | null>(null);
  const [reverseTableId, setReverseTableId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ bookingId: string; overTableId: string | null } | null>(null);
  const [bookingErrors, setBookingErrors] = useState<Readonly<Record<string, string>>>({});
  const [flashTableId, setFlashTableId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [drafts, dispatchDraft] = useReducer(layoutDraftReducer, {});
  const [saveErrors, setSaveErrors] = useState<Readonly<Record<string, string>>>({});
  const flashTimer = useRef<number | null>(null);
  const dragRef = useRef<{ bookingId: string; overTableId: string | null } | null>(null);

  const ctxBase = { nowMs, today, timezone };
  const service: FloorServiceFilter =
    serviceChoice ?? (snapshot ? defaultService(snapshot, { ...ctxBase, atMs: nowMs }) : 'all');
  const followDefault = atMsChoice === null;
  const atMs = atMsChoice ?? (snapshot ? defaultTimeFor(snapshot, service, ctxBase) : nowMs);
  const ctx = useMemo(() => ({ nowMs, today, timezone, atMs }), [atMs, nowMs, timezone, today]);

  const window_ = snapshot ? serviceWindow(snapshot, service) : null;

  const layout = useMemo(
    () =>
      snapshot
        ? layoutFloorPlan(snapshot.zones, snapshot.tables, mode === 'arrange' ? drafts : {})
        : null,
    [drafts, mode, snapshot],
  );
  // Joins are suggested from the saved layout, not from unsaved drafts.
  const serviceLayout = useMemo(
    () => (snapshot ? layoutFloorPlan(snapshot.zones, snapshot.tables) : null),
    [snapshot],
  );

  const states = useMemo(
    () =>
      snapshot
        ? computeTableStates(snapshot, ctx, assignments.pending)
        : new Map<string, TableState>(),
    [assignments.pending, ctx, snapshot],
  );

  const readOnly = snapshot ? isReadOnly(snapshot, ctx) : true;
  const needs = useMemo(
    () => (snapshot ? bookingsNeedingTable(snapshot, window_) : []),
    [snapshot, window_],
  );
  const counts = useMemo(
    () => (snapshot ? serviceCounts(snapshot, states, window_) : null),
    [snapshot, states, window_],
  );

  const tableById = useMemo(
    () => new Map((snapshot?.tables ?? []).map((t) => [t.id, t])),
    [snapshot],
  );
  const bookingById = useMemo(
    () => new Map((snapshot?.bookings ?? []).map((b) => [b.id, b])),
    [snapshot],
  );

  const dirtyIds = useMemo(
    () => (snapshot ? dirtyTableIds(drafts, snapshot.tables) : []),
    [drafts, snapshot],
  );
  useRegisterOpsUnsavedChanges(
    'floor-plan-layout',
    dirtyIds.length > 0,
    `You have ${dirtyIds.length} unsaved layout ${dirtyIds.length === 1 ? 'change' : 'changes'}. Leave without saving?`,
  );

  const announce = useCallback(
    (message: string) => {
      setAnnouncement('');
      window.setTimeout(() => setAnnouncement(message), 30);
    },
    [setAnnouncement],
  );

  const flash = useCallback(
    (tableId: string) => {
      setFlashTableId(tableId);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashTableId(null), 2400);
    },
    [setFlashTableId],
  );
  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  // A restaurant switch or a new date starts from a clean slate.
  useEffect(() => {
    setSelectedTableId(null);
    setFocusBookingId(null);
    setPick(null);
    setReverseTableId(null);
    setStatFilter(null);
    setBookingErrors({});
  }, [restaurantId, date]);

  /* ───────── time & navigation ───────── */

  const goToDate = useCallback(
    (next: string | null) => {
      const apply = () => {
        dispatchDraft({ type: 'discard' });
        setRequestedDate(next);
        setServiceChoice(null);
        setAtMsChoice(null);
      };
      if (dirtyIds.length > 0) setConfirm({ kind: 'leave-arrange', then: apply });
      else apply();
    },
    [dirtyIds.length, dispatchDraft, setAtMsChoice, setConfirm, setServiceChoice],
  );

  const chooseService = useCallback(
    (next: FloorServiceFilter) => {
      setServiceChoice(next);
      setAtMsChoice(null);
      setSelectedTableId(null);
      setPick(null);
    },
    [setAtMsChoice, setPick, setSelectedTableId, setServiceChoice],
  );

  const scrubTo = useCallback(
    (ms: number) => {
      const live = snapshot ? isLiveDate(snapshot, ctx) : false;
      // Snap back to "now" so the plan keeps following the clock.
      setAtMsChoice(live && Math.abs(ms - nowMs) < 5 * MINUTE_MS ? null : ms);
      setPick(null);
    },
    [ctx, nowMs, setAtMsChoice, setPick, snapshot],
  );

  const goToNow = useCallback(() => {
    if (requestedDate !== null && requestedDate !== today) goToDate(null);
    setServiceChoice(null);
    setAtMsChoice(null);
    announce(`Showing now, ${formatClock(nowMs, timezone)}`);
  }, [announce, goToDate, nowMs, requestedDate, setAtMsChoice, setServiceChoice, timezone, today]);

  /* ───────── selection ───────── */

  const closeSelection = useCallback(() => {
    setSelectedTableId(null);
    setFocusBookingId(null);
    setReverseTableId(null);
  }, [setFocusBookingId, setReverseTableId, setSelectedTableId]);

  const runAssignment = useCallback(
    async (booking: FloorBooking, tableIds: string[], kind: 'assign' | 'move') => {
      if (!snapshot) return;
      const from = [...booking.tableIds];
      const label = tableNumbers(snapshot, tableIds);
      setPick(null);
      setReverseTableId(null);
      setBookingErrors(({ [booking.id]: _removed, ...rest }) => rest);
      announce(`${kind === 'move' ? 'Moving' : 'Assigning'} ${booking.name} to ${label}…`);
      try {
        if (kind === 'move') await assignments.move(booking.id, from, tableIds);
        else await assignments.assign(booking.id, tableIds);
        const message = `${booking.name} · ${booking.partySize} ${kind === 'move' ? 'moved to' : 'assigned to'} ${label}`;
        announce(message);
        toast.success(message, {
          action: {
            label: 'Undo',
            onClick: () => {
              const undo =
                kind === 'move'
                  ? assignments.move(booking.id, tableIds, from)
                  : assignments.unassign(booking.id, tableIds);
              undo.then(
                () => announce('Undone'),
                (error: unknown) =>
                  toast.error(`Couldn’t undo. ${toAssignmentError(error).message}`),
              );
            },
          },
        });
      } catch (error) {
        const mapped = toAssignmentError(error);
        const verb = kind === 'move' ? 'moved' : 'assigned';
        const message =
          mapped.restored === false
            ? `Not moved, and ${booking.name} lost the original table. They’re back in Needs a table.`
            : `Not ${verb}. ${mapped.message}`;
        setBookingErrors((current) => ({ ...current, [booking.id]: message }));
        if (tableIds[0]) flash(tableIds[0]);
        if (kind === 'move') setFocusBookingId(booking.id);
        toast.error(message);
        announce(message);
      }
    },
    [
      announce,
      assignments,
      flash,
      setBookingErrors,
      setFocusBookingId,
      setPick,
      setReverseTableId,
      snapshot,
    ],
  );

  const tryTableForBooking = useCallback(
    (tableId: string, bookingId: string, kind: 'assign' | 'move'): boolean => {
      const table = tableById.get(tableId);
      const booking = bookingById.get(bookingId);
      if (!snapshot || !serviceLayout || !table || !booking) return false;
      const fit = checkTableForBooking(snapshot, table, booking, ctx, serviceLayout);
      if (!fit.ok) {
        announce(fit.reason);
        toast.error(fit.reason);
        return false;
      }
      void runAssignment(booking, fit.tableIds, kind);
      return true;
    },
    [announce, bookingById, ctx, runAssignment, serviceLayout, snapshot, tableById],
  );

  const selectTable = useCallback(
    (tableId: string) => {
      if (pick) {
        tryTableForBooking(tableId, pick.bookingId, pick.kind);
        return;
      }
      setSelectedTableId(tableId);
      setFocusBookingId(null);
      setReverseTableId(null);
    },
    [pick, setFocusBookingId, setReverseTableId, setSelectedTableId, tryTableForBooking],
  );

  const focusBooking = useCallback(
    (bookingId: string, tableId?: string) => {
      if (tableId) setSelectedTableId(tableId);
      setFocusBookingId(bookingId);
    },
    [setFocusBookingId, setSelectedTableId],
  );

  const startPick = useCallback(
    (bookingId: string, kind: 'assign' | 'move') => {
      setPick({ bookingId, kind });
      setReverseTableId(null);
      setStatFilter(null);
      if (view === 'timeline') setView('plan');
      const booking = bookingById.get(bookingId);
      if (booking)
        announce(
          `Choose a table for ${booking.name}, ${booking.partySize}. Highlighted tables can take it.`,
        );
    },
    [announce, bookingById, setPick, setReverseTableId, setStatFilter, setView, view],
  );

  const cancelPick = useCallback(() => {
    setPick(null);
    announce('Cancelled');
  }, [announce, setPick]);

  const quickAssign = useCallback(
    (bookingId: string) => {
      const booking = bookingById.get(bookingId);
      if (!snapshot || !serviceLayout || !booking) return;
      const best = bestFitForBooking(snapshot, booking, ctx, serviceLayout);
      if (best) void runAssignment(booking, best.tableIds, 'assign');
    },
    [bookingById, ctx, runAssignment, serviceLayout, snapshot],
  );

  const unassign = useCallback(
    async (bookingId: string) => {
      const booking = bookingById.get(bookingId);
      if (!booking || !snapshot) return;
      const previous = [...booking.tableIds];
      setFocusBookingId(null);
      try {
        await assignments.unassign(booking.id, previous);
        toast.success(`${booking.name} · ${booking.partySize} now needs a table`, {
          action: {
            label: 'Undo',
            onClick: () => {
              assignments
                .assign(booking.id, previous)
                .catch((error: unknown) =>
                  toast.error(`Couldn’t undo. ${toAssignmentError(error).message}`),
                );
            },
          },
        });
      } catch (error) {
        const message = `Not unassigned. ${toAssignmentError(error).message}`;
        setBookingErrors((current) => ({ ...current, [booking.id]: message }));
        toast.error(message);
      }
    },
    [assignments, bookingById, setBookingErrors, setFocusBookingId, snapshot],
  );

  /* ───────── drag to assign ───────── */

  const startDrag = useCallback(
    (bookingId: string) => {
      dragRef.current = { bookingId, overTableId: null };
      setDrag({ bookingId, overTableId: null });
      setBookingErrors(({ [bookingId]: _removed, ...rest }) => rest);
      if (view === 'timeline' || listOn) {
        setView('plan');
        setListOn(false);
      }
      const booking = bookingById.get(bookingId);
      if (booking)
        announce(
          `Dragging ${booking.name}. Tables that can take ${booking.partySize} are highlighted.`,
        );
    },
    [announce, bookingById, listOn, setBookingErrors, setDrag, setListOn, setView, view],
  );

  const dragOver = useCallback(
    (tableId: string | null) => {
      if (dragRef.current) dragRef.current.overTableId = tableId;
      setDrag((current) =>
        current && current.overTableId !== tableId ? { ...current, overTableId: tableId } : current,
      );
    },
    [setDrag],
  );

  const endDrag = useCallback(() => {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current?.overTableId) return;
    const booking = bookingById.get(current.bookingId);
    const table = tableById.get(current.overTableId);
    if (!booking || !table || !snapshot || !serviceLayout) return;
    const fit = checkTableForBooking(snapshot, table, booking, ctx, serviceLayout);
    if (fit.ok) {
      void runAssignment(booking, fit.tableIds, 'assign');
      return;
    }
    setBookingErrors((errors) => ({ ...errors, [booking.id]: `Not assigned. ${fit.reason}` }));
    announce(fit.reason);
  }, [
    announce,
    bookingById,
    ctx,
    runAssignment,
    serviceLayout,
    setBookingErrors,
    setDrag,
    snapshot,
    tableById,
  ]);

  /* ───────── lifecycle ───────── */

  const runLifecycle = useCallback(
    async (action: FloorPlanLifecycleAction, bookingId: string) => {
      const booking = bookingById.get(bookingId);
      if (!booking || !snapshot) return;
      const tables = tableNumbers(snapshot, booking.tableIds);
      try {
        const outcome = await lifecycle.run(action, bookingId);
        const who = `${booking.name} · ${booking.partySize}`;
        if (outcome === 'queued') {
          const message = `You’re offline. ${who} will update when the connection is back.`;
          toast.info(message);
          announce(message);
          return;
        }
        if (action === 'check-in') toast.success(`${who} checked in at ${tables}`);
        if (action === 'complete')
          toast.success(
            `${booking.name} completed. ${tables} ${booking.tableIds.length > 1 ? 'are' : 'is'} free.`,
          );
        if (action === 'no-show') {
          toast.success(`${booking.name} marked no-show. ${tables} is free.`, {
            action: {
              label: 'Undo',
              onClick: () => {
                lifecycle
                  .run('undo-no-show', bookingId)
                  .catch((error: unknown) =>
                    toast.error(lifecycleErrorMessage('undo-no-show', error)),
                  );
              },
            },
          });
        }
        if (action === 'complete' || action === 'no-show') setFocusBookingId(null);
        announce(`${who}: done`);
      } catch (error) {
        const message = lifecycleErrorMessage(action, error);
        setBookingErrors((current) => ({ ...current, [bookingId]: message }));
        toast.error(message);
        announce(message);
      }
    },
    [announce, bookingById, lifecycle, setBookingErrors, setFocusBookingId, snapshot],
  );

  const confirmNoShow = useCallback(
    (bookingId: string) => setConfirm({ kind: 'no-show', bookingId }),
    [setConfirm],
  );

  /* ───────── arrange ───────── */

  const switchMode = useCallback(
    (next: FloorMode) => {
      if (next === mode) return;
      const apply = () => {
        dispatchDraft({ type: 'discard' });
        setSaveErrors({});
        setMode(next);
        setView('plan');
        setListOn(false);
        setPick(null);
        setStatFilter(null);
        setSelectedTableId(null);
      };
      if (mode === 'arrange' && dirtyIds.length > 0)
        setConfirm({ kind: 'leave-arrange', then: apply });
      else apply();
    },
    [
      dirtyIds.length,
      dispatchDraft,
      mode,
      setConfirm,
      setListOn,
      setMode,
      setPick,
      setSaveErrors,
      setSelectedTableId,
      setStatFilter,
      setView,
    ],
  );

  const placeTable = useCallback(
    (table: FloorTable, position: FloorPosition) => {
      const zone = layout?.zoneById.get(table.zoneId);
      if (!zone) return;
      dispatchDraft({ type: 'place', table, position, zone });
    },
    [dispatchDraft, layout],
  );

  const nudgeTable = useCallback(
    (tableId: string, dx: number, dy: number) => {
      const table = tableById.get(tableId);
      const placed = layout?.tables.get(tableId);
      const zone = table && layout?.zoneById.get(table.zoneId);
      if (!table || !placed || !zone) return;
      dispatchDraft({ type: 'nudge', table, base: placed.relative, dx, dy, rotate: 0, zone });
      const target = { x: placed.relative.x + dx, y: placed.relative.y + dy };
      const clamped = clampToZone(table, { ...target, rotation: placed.rotation }, zone);
      if (clamped.x !== Math.round(target.x) || clamped.y !== Math.round(target.y)) {
        announce(`${table.number} is at the edge of ${zone.name}. Tables stay in their zone.`);
      }
    },
    [announce, dispatchDraft, layout, tableById],
  );

  const rotateTable = useCallback(
    (tableId: string, delta: number) => {
      const table = tableById.get(tableId);
      const placed = layout?.tables.get(tableId);
      const zone = table && layout?.zoneById.get(table.zoneId);
      if (!table || !placed || !zone) return;
      dispatchDraft({
        type: 'nudge',
        table,
        base: placed.relative,
        dx: 0,
        dy: 0,
        rotate: delta,
        zone,
      });
      announce(`${table.number} rotated to ${(((placed.rotation + delta) % 360) + 360) % 360}°`);
    },
    [announce, dispatchDraft, layout, tableById],
  );

  const resetZone = useCallback(
    (zoneId: string) => {
      const zone = layout?.zoneById.get(zoneId);
      if (!zone || !snapshot) return;
      dispatchDraft({
        type: 'reset-zone',
        tables: snapshot.tables.filter((t) => t.zoneId === zoneId),
        zone,
      });
      announce(`${zone.name} reset. Save to keep it.`);
    },
    [announce, dispatchDraft, layout, snapshot],
  );

  const discardLayout = useCallback(() => {
    dispatchDraft({ type: 'discard' });
    setSaveErrors({});
    announce('Layout changes discarded');
  }, [announce, dispatchDraft, setSaveErrors]);

  const saveLayout = useCallback(async () => {
    if (!layout || dirtyIds.length === 0) return;
    const changes = dirtyIds.flatMap((tableId) => {
      const placed = layout.tables.get(tableId);
      return placed ? [{ tableId, position: placed.relative }] : [];
    });
    setSaveErrors({});
    try {
      const result = await layoutSave.mutateAsync(changes);
      dispatchDraft({ type: 'keep-only', tableIds: result.failed.map((f) => f.tableId) });
      if (result.failed.length === 0) {
        toast.success(
          `Layout saved · ${result.saved.length} ${result.saved.length === 1 ? 'table' : 'tables'}`,
        );
      } else {
        setSaveErrors(Object.fromEntries(result.failed.map((f) => [f.tableId, f.message])));
        const message = `${result.failed.length} of ${changes.length} tables weren’t saved. ${result.failed[0]?.message ?? ''} Your other changes are saved.`;
        toast.error(message);
        announce(message);
      }
    } catch {
      toast.error('Layout not saved. Your changes are still here.');
    }
  }, [announce, dirtyIds, dispatchDraft, layout, layoutSave, setSaveErrors]);

  const confirmAction = useCallback(() => {
    const current = confirm;
    setConfirm(null);
    if (!current) return;
    if (current.kind === 'no-show') void runLifecycle('no-show', current.bookingId);
    if (current.kind === 'leave-arrange') current.then();
    if (current.kind === 'reset-zone') resetZone(current.zoneId);
  }, [confirm, resetZone, runLifecycle, setConfirm]);

  const { refresh: refreshData } = data;
  const pickTable = useCallback(
    (tableId: string) => (pick ? tryTableForBooking(tableId, pick.bookingId, pick.kind) : false),
    [pick, tryTableForBooking],
  );
  const assignHere = useCallback(
    (bookingId: string, tableId: string) => tryTableForBooking(tableId, bookingId, 'assign'),
    [tryTableForBooking],
  );
  const requestResetZone = useCallback(
    (zoneId: string) => setConfirm({ kind: 'reset-zone', zoneId }),
    [setConfirm],
  );
  const cancelConfirm = useCallback(() => setConfirm(null), [setConfirm]);
  const refresh = useCallback(async () => {
    await refreshData();
    announce('Floor plan updated');
  }, [announce, refreshData]);

  const actions = useMemo(
    () => ({
      goToDate,
      goToNow,
      chooseService,
      scrubTo,
      setView,
      setListOn,
      switchMode,
      setZoneFilter,
      setStatFilter,
      selectTable,
      setSelectedTableId,
      focusBooking,
      closeSelection,
      startPick,
      cancelPick,
      pickTable,
      quickAssign,
      assignHere,
      setReverseTableId,
      unassign,
      runLifecycle,
      confirmNoShow,
      startDrag,
      dragOver,
      endDrag,
      placeTable,
      nudgeTable,
      rotateTable,
      requestResetZone,
      discardLayout,
      saveLayout,
      confirmAction,
      cancelConfirm,
      refresh,
      announce,
    }),
    [
      announce,
      assignHere,
      cancelConfirm,
      cancelPick,
      chooseService,
      closeSelection,
      confirmAction,
      confirmNoShow,
      discardLayout,
      dragOver,
      endDrag,
      focusBooking,
      goToDate,
      goToNow,
      nudgeTable,
      pickTable,
      placeTable,
      quickAssign,
      refresh,
      requestResetZone,
      rotateTable,
      runLifecycle,
      saveLayout,
      scrubTo,
      selectTable,
      setListOn,
      setReverseTableId,
      setSelectedTableId,
      setStatFilter,
      setView,
      setZoneFilter,
      startDrag,
      startPick,
      switchMode,
      unassign,
    ],
  );

  return {
    restaurantId,
    canArrange,
    data,
    snapshot,
    layout,
    serviceLayout,
    states,
    counts,
    needs,
    ctx,
    date,
    today,
    timezone,
    readOnly,
    followDefault,
    service,
    serviceWindow: window_,
    view,
    listOn,
    mode,
    zoneFilter,
    statFilter,
    selectedTableId,
    focusBookingId,
    pick,
    reverseTableId,
    drag,
    bookingErrors,
    flashTableId,
    confirm,
    announcement,
    pending: assignments.pending,
    lifecycleBusy: lifecycle.busy,
    drafts,
    dirtyIds,
    saveErrors,
    isSavingLayout: layoutSave.isPending,
    tableById,
    bookingById,
    actions,
  };
}

export type FloorPlanController = ReturnType<typeof useFloorPlanController>;
