'use client';

import { CalendarX, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import { SettingsLoadErrorAlert } from '@/components/features/restaurant-settings/shared/SettingsLoadErrorAlert';
import { SettingsNoRestaurantState } from '@/components/features/restaurant-settings/shared/SettingsNoRestaurantState';
import { SettingsRefreshErrorAlert } from '@/components/features/restaurant-settings/shared/SettingsRefreshErrorAlert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/useMediaQuery';

import { FloorPlanCanvas } from './FloorPlanCanvas';
import { FloorPlanPanel } from './FloorPlanPanel';
import { FloorPlanList, FloorPlanTimeline } from './FloorPlanTimeline';
import {
  FloorLayoutSaveBar,
  FloorPlanSummary,
  FloorPlanToolbar,
  TABLES_SETTINGS_HREF,
} from './FloorPlanToolbar';
import { tableNumbers } from './model/floorPlanState';
import { formatClock, formatLongDate } from './model/floorPlanTime';
import { floorPlanBody } from './model/floorPlanView';
import {
  useFloorPlanController,
  type FloorPlanController,
  type FloorSurface,
} from './useFloorPlanController';

/** Workspace states (no restaurant, load failure, empty) sit centred in the canvas. */
function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center px-[var(--ops-shell-gutter)] py-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function LoadingPlan() {
  return (
    <div
      className="relative min-h-0 flex-1 p-4"
      aria-busy="true"
      aria-label="Loading the floor plan"
    >
      <div className="grid h-full grid-cols-[3fr_2fr] grid-rows-[2fr_1fr] gap-4">
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
        <Skeleton className="col-span-2 h-full" />
      </div>
      <span className="sr-only" role="status">
        Loading the floor plan…
      </span>
    </div>
  );
}

function ViewArea({ fp, phone }: { fp: FloorPlanController; phone: boolean }) {
  const { data, snapshot } = fp;
  const arranging = fp.mode === 'arrange';
  if (data.status === 'no-restaurant') {
    return (
      <CenteredState>
        <SettingsNoRestaurantState
          task={arranging ? 'arrange its floor layout' : 'see its floor plan'}
        />
      </CenteredState>
    );
  }
  if (data.status === 'loading') return <LoadingPlan />;
  if (data.status === 'error' || !snapshot) {
    const what = data.failedSources
      .map((s) => (s === 'bookings' ? 'bookings' : s === 'tables' ? 'tables' : 'service times'))
      .join(' and ');
    return (
      <CenteredState>
        <SettingsLoadErrorAlert
          title={
            arranging ? 'Couldn’t load your tables' : `Couldn’t load ${what || 'the floor plan'}`
          }
          message={
            <>
              {arranging
                ? 'Your floor layout is unchanged.'
                : `${formatLongDate(fp.date)} couldn’t be loaded.`}
              {data.updatedAt
                ? ` The last update was at ${formatClock(data.updatedAt, fp.timezone)}.`
                : ''}
            </>
          }
          error={data.error}
          onRetry={() => void fp.actions.refresh()}
        />
      </CenteredState>
    );
  }
  if (snapshot.tables.length === 0) {
    return (
      <CenteredState>
        <OpsEmptyState
          icon={<LayoutGrid className="size-5" aria-hidden />}
          title="No tables yet"
          description={
            fp.canArrange
              ? 'The floor plan is drawn from your tables. Add tables and zones in Tables settings, then come back to see them here.'
              : 'The floor plan is drawn from your tables. Ask a manager to add tables and zones in settings.'
          }
          action={
            // Settings are admin-only; hosts and servers would be bounced to Bookings.
            fp.canArrange ? (
              <Button asChild>
                <Link href={TABLES_SETTINGS_HREF}>Go to Tables settings</Link>
              </Button>
            ) : undefined
          }
        />
      </CenteredState>
    );
  }
  // Arranging the saved layout doesn't depend on the day's services.
  if (fp.mode === 'service' && (snapshot.isClosed || !snapshot.window)) {
    return (
      <CenteredState>
        <OpsEmptyState
          icon={<CalendarX className="size-5" aria-hidden />}
          title={`Closed on ${formatLongDate(snapshot.date)}`}
          description="There are no services on this date, so there is nothing to seat. Pick another day, or check opening hours in settings."
        />
      </CenteredState>
    );
  }
  const body = floorPlanBody({ mode: fp.mode, view: fp.view, listOn: fp.listOn, phone });
  if (body === 'timeline') return <FloorPlanTimeline fp={fp} />;
  if (body === 'list') return <FloorPlanList fp={fp} withNeeds={phone} />;
  return <FloorPlanCanvas fp={fp} />;
}

function FloorPlanConfirmDialog({ fp }: { fp: FloorPlanController }) {
  const { confirm, snapshot } = fp;
  let title = '';
  let body = '';
  let ok = '';
  let destructive = false;
  let cancel = 'Cancel';
  if (confirm?.kind === 'no-show') {
    const b = fp.bookingById.get(confirm.bookingId);
    if (b && snapshot) {
      title = `Mark ${b.name} · ${b.partySize} as a no-show?`;
      body = `The ${formatClock(b.startMs, fp.timezone)} booking is marked no-show and ${tableNumbers(snapshot, b.tableIds)} is freed. You can undo this straight away, or later from Bookings.`;
      ok = 'Mark no-show';
      destructive = true;
    }
  } else if (confirm?.kind === 'leave-arrange') {
    const n = fp.dirtyIds.length;
    title = `Discard ${n} layout ${n === 1 ? 'change' : 'changes'}?`;
    body = 'You haven’t saved the new positions. Leaving puts every table back where it was.';
    ok = 'Discard changes';
    cancel = 'Keep arranging';
    destructive = true;
  } else if (confirm?.kind === 'reset-zone') {
    const zone = snapshot?.zones.find((z) => z.id === confirm.zoneId);
    title = `Reset ${zone?.name ?? 'zone'} layout?`;
    body = `Every table in ${zone?.name ?? 'this zone'} goes back to a tidy grid. Nothing is saved until you choose Save layout.`;
    ok = 'Reset zone layout';
  }
  return (
    <ConfirmDialog
      open={Boolean(confirm && title)}
      onOpenChange={(open) => {
        if (!open) fp.actions.cancelConfirm();
      }}
      title={title}
      description={body}
      confirmLabel={ok}
      cancelLabel={cancel}
      tone={destructive ? 'destructive' : 'default'}
      onConfirm={fp.actions.confirmAction}
    />
  );
}

export function FloorPlanClient({
  initialDate,
  surface = 'service',
}: {
  initialDate: string | null;
  surface?: FloorSurface;
}) {
  const fp = useFloorPlanController({ initialDate, surface });
  const phone = useMediaQuery('(max-width: 639px)');
  const narrow = useMediaQuery('(max-width: 1099px)');
  const [sheet, setSheet] = useState<'peek' | 'open'>('peek');
  const { selectedTableId, pick, drag, confirm, actions } = fp;

  // On narrow screens the panel is a sheet: open it for selections and picks, tuck it away while dragging.
  useEffect(() => {
    if (!narrow) return;
    if (drag) setSheet('peek');
    else if (selectedTableId || pick) setSheet('open');
  }, [drag, narrow, pick, selectedTableId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (confirm) return;
      const target = event.target as HTMLElement | null;
      const inField = target?.closest(
        'input, select, textarea, [contenteditable="true"], [role="dialog"]',
      );
      if (event.key === 'Escape') {
        if (inField) return;
        if (pick) actions.cancelPick();
        else if (selectedTableId) actions.closeSelection();
        else if (sheet === 'open') setSheet('peek');
        return;
      }
      if (inField || event.metaKey || event.ctrlKey || event.altKey) return;
      if (surface === 'service' && (event.key === 'n' || event.key === 'N')) actions.goToNow();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, confirm, pick, selectedTableId, sheet, surface]);

  const showSummary =
    fp.data.status === 'ready' && Boolean(fp.snapshot?.tables.length) && fp.snapshot?.window;

  return (
    <div
      className={
        surface === 'layout'
          ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden'
          : 'flex min-h-[calc(100dvh-7rem)] flex-1 flex-col md:h-svh md:min-h-0 md:overflow-hidden'
      }
    >
      <FloorPlanToolbar fp={fp} />
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col max-[1099px]:pb-14">
          {surface === 'layout' && fp.data.refreshError ? (
            // The last loaded layout stays on screen; unsaved positions are kept.
            <div className="shrink-0 border-b border-border/60 px-[var(--ops-shell-gutter)] py-3">
              <SettingsRefreshErrorAlert
                error={fp.data.refreshError}
                onRetry={() => void fp.actions.refresh()}
              />
            </div>
          ) : null}
          {showSummary ? <FloorPlanSummary fp={fp} /> : null}
          <ViewArea fp={fp} phone={phone} />
        </div>
        <FloorPlanPanel
          fp={fp}
          sheet={sheet}
          onSheetChange={(next) => {
            setSheet(next);
            if (next === 'peek' && phone) actions.closeSelection();
          }}
        />
      </div>
      <FloorPlanConfirmDialog fp={fp} />
      <FloorLayoutSaveBar fp={fp} />
      <div className="sr-only" aria-live="polite">
        {fp.announcement}
      </div>
    </div>
  );
}

/** The Floor layout settings workspace: the saved room, always in arrange mode. */
export function FloorLayoutClient() {
  return <FloorPlanClient initialDate={null} surface="layout" />;
}
