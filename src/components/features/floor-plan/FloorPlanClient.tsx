'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Button } from '@/components/ui/button';
import { BookingStateMachineProvider } from '@/contexts/booking-state-machine';

import { FloorPlanCanvas } from './FloorPlanCanvas';
import { FloorPlanCockpit } from './FloorPlanCockpit';
import { FloorPlanDetailPanel } from './FloorPlanDetailPanel';
import { FloorPlanLegendFilter } from './FloorPlanLegendFilter';
import { formatClock } from './format';
import { TimeScrubber } from './TimeScrubber';
import { useFloorPlanState } from './useFloorPlanState';

export type FloorPlanClientProps = {
  initialNowIso: string;
};

export function FloorPlanClient({ initialNowIso }: FloorPlanClientProps) {
  return (
    <BookingStateMachineProvider>
      <FloorPlanClientContent initialNowIso={initialNowIso} />
    </BookingStateMachineProvider>
  );
}

function FloorPlanClientContent({ initialNowIso }: FloorPlanClientProps) {
  const fp = useFloorPlanState({ initialNowIso });
  const clock = formatClock(fp.effectiveMs, fp.timezone);
  const summary = `${fp.stats.totalTables} tables across ${fp.stats.zoneCount} zones · ${fp.stats.capacity} covers`;

  return (
    <OpsPageShell variant="immersive">
      <div className="flex h-full flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6">
        <FloorPlanCockpit
          venueName={fp.venueName}
          kicker={`Service floor · ${clock}`}
          summary={summary}
          stats={fp.stats}
          canEdit={fp.canEdit}
          editMode={fp.editMode}
          onToggleEdit={fp.toggleEditMode}
        />

        <p className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
          {fp.editMode ? (
            <span className="text-primary">Drag movable tables to arrange · changes save automatically</span>
          ) : (
            <span>Tap a table to seat or clear · tap a state to filter · scrub time to replay service</span>
          )}
          {fp.seeded ? <span> · showing a suggested layout until you arrange tables</span> : null}
        </p>

        {fp.isError ? (
          <FloorPlanErrorState onRetry={fp.refetch} />
        ) : (
          <div className="flex flex-1 flex-col gap-4 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Floor map
                  </span>
                  <span className="h-px flex-1 bg-border" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                    Showing {clock}
                  </span>
                </div>

                {fp.isLoading ? (
                  <FloorPlanCanvasSkeleton />
                ) : fp.isEmpty ? (
                  <FloorPlanEmptyState />
                ) : (
                  <FloorPlanCanvas
                    nodes={fp.nodes}
                    zones={fp.zones}
                    joinLinks={fp.joinLinks}
                    joinBoxes={fp.joinBoxes}
                    editMode={fp.editMode}
                    timezone={fp.timezone}
                    onSelectTable={fp.selectTable}
                    onPreviewDrag={fp.previewDrag}
                    onCommitDrag={fp.commitDrag}
                  />
                )}

                <div className="my-4 h-px bg-border" />

                <TimeScrubber
                  windowStartMs={fp.windowStartMs}
                  windowEndMs={fp.windowEndMs}
                  effectiveMs={fp.effectiveMs}
                  liveNowMs={fp.liveNowMs}
                  scrubbing={fp.scrubbing}
                  playing={fp.playing}
                  timezone={fp.timezone}
                  seatedCovers={fp.stats.seatedCovers}
                  bookedCovers={fp.stats.bookedCovers}
                  onScrub={fp.setScrub}
                  onTogglePlay={fp.togglePlay}
                  onBackToNow={fp.backToNow}
                />
              </div>

              <FloorPlanLegendFilter
                legend={fp.legend}
                spotlight={fp.spotlight}
                onToggle={fp.toggleSpotlight}
              />
            </div>

            <FloorPlanDetailPanel
              selectedNode={fp.selectedNode}
              joinGroup={fp.joinGroupForSelected}
              zones={fp.zones}
              timezone={fp.timezone}
              canEdit={fp.canEdit}
              isSeating={fp.isSeating}
              isClearing={fp.isClearing}
              onClose={fp.clearSelection}
              onSeatParty={fp.seatParty}
              onClearTable={fp.clearTable}
              onMarkNoShow={fp.markNoShowParty}
              onSplit={fp.splitTable}
            />
          </div>
        )}
      </div>
    </OpsPageShell>
  );
}

function FloorPlanCanvasSkeleton() {
  return (
    <div
      className="w-full animate-pulse rounded-xl border border-border bg-muted/30"
      style={{ aspectRatio: '16 / 10', minHeight: 420 }}
      aria-busy
      aria-label="Loading floor map"
    />
  );
}

function FloorPlanEmptyState() {
  return (
    <div
      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/10 p-10 text-center"
      style={{ minHeight: 420 }}
    >
      <p className="text-sm font-medium text-foreground">No tables yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add tables in Settings → Restaurant → Tables and they will appear here, ready to arrange
        and seat.
      </p>
    </div>
  );
}

function FloorPlanErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-destructive/5 p-8">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="size-5" />
        <span className="font-medium">Unable to load the floor plan</span>
      </div>
      <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
        <RefreshCw className="size-4" /> Retry
      </Button>
    </div>
  );
}
