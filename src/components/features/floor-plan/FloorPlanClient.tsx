'use client';

import { CalendarX, LayoutGrid, RefreshCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/useMediaQuery';

import { FloorPlanCanvas } from './FloorPlanCanvas';
import { FloorPlanPanel } from './FloorPlanPanel';
import { FloorPlanList, FloorPlanTimeline } from './FloorPlanTimeline';
import { FloorPlanSummary, FloorPlanToolbar } from './FloorPlanToolbar';
import { tableNumbers } from './model/floorPlanState';
import { formatClock, formatLongDate } from './model/floorPlanTime';
import { useFloorPlanController, type FloorPlanController } from './useFloorPlanController';

function CenteredState({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
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
  if (data.status === 'loading') return <LoadingPlan />;
  if (data.status === 'error' || !snapshot) {
    const what = data.failedSources
      .map((s) => (s === 'bookings' ? 'bookings' : s === 'tables' ? 'tables' : 'service times'))
      .join(' and ');
    return (
      <CenteredState icon={<TriangleAlert className="size-5" />} title="The floor plan didn’t load">
        <Alert variant="destructive" className="text-left">
          <AlertIcon>
            <TriangleAlert className="size-4" aria-hidden />
          </AlertIcon>
          <AlertTitle>Couldn’t fetch {what || 'the floor plan'}</AlertTitle>
          <AlertDescription>
            {formatLongDate(fp.date)} couldn’t be loaded.
            {data.updatedAt
              ? ` The last update was at ${formatClock(data.updatedAt, fp.timezone)}.`
              : ''}
          </AlertDescription>
        </Alert>
        <Button onClick={() => void fp.actions.refresh()}>
          <RefreshCw aria-hidden />
          Try again
        </Button>
      </CenteredState>
    );
  }
  if (snapshot.tables.length === 0) {
    return (
      <CenteredState icon={<LayoutGrid className="size-5" />} title="No tables yet">
        <p className="text-sm text-muted-foreground">
          The floor plan is drawn from your tables. Add tables and zones in Tables settings, then
          come back to see them here.
        </p>
        <Button asChild>
          <Link href="/app/settings/tables">Go to Tables settings</Link>
        </Button>
      </CenteredState>
    );
  }
  if (snapshot.isClosed || !snapshot.window) {
    return (
      <CenteredState
        icon={<CalendarX className="size-5" />}
        title={`Closed on ${formatLongDate(snapshot.date)}`}
      >
        <p className="text-sm text-muted-foreground">
          There are no services on this date, so there is nothing to seat. Pick another day, or
          check opening hours in settings.
        </p>
      </CenteredState>
    );
  }
  if (fp.view === 'timeline' && fp.mode === 'service') return <FloorPlanTimeline fp={fp} />;
  if (phone || fp.listOn) return <FloorPlanList fp={fp} withNeeds={phone} />;
  return <FloorPlanCanvas fp={fp} />;
}

function ConfirmDialog({ fp }: { fp: FloorPlanController }) {
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
    <AlertDialog
      open={Boolean(confirm && title)}
      onOpenChange={(open) => !open && fp.actions.cancelConfirm()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={fp.actions.confirmAction}
            className={
              destructive ? 'bg-destructive/10 text-destructive hover:bg-destructive/15' : undefined
            }
          >
            {ok}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FloorPlanClient({ initialDate }: { initialDate: string | null }) {
  const fp = useFloorPlanController({ initialDate });
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
      if (event.key === 'n' || event.key === 'N') actions.goToNow();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, confirm, pick, selectedTableId, sheet]);

  const showSummary =
    fp.data.status === 'ready' && Boolean(fp.snapshot?.tables.length) && fp.snapshot?.window;

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-1 flex-col md:h-svh md:min-h-0 md:overflow-hidden">
      <FloorPlanToolbar fp={fp} />
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col max-[1099px]:pb-14">
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
      <ConfirmDialog fp={fp} />
      <div className="sr-only" aria-live="polite">
        {fp.announcement}
      </div>
    </div>
  );
}
