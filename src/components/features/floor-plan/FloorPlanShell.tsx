'use client';

import { RotateCcw, X } from 'lucide-react';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { FloorPlanCanvas } from './FloorPlanCanvas';
import { FloorPlanCockpit } from './FloorPlanCockpit';
import { FloorPlanDetailPanel } from './FloorPlanDetailPanel';
import { FloorPlanHeader } from './FloorPlanHeader';
import { FloorPlanLegendFilter } from './FloorPlanLegendFilter';
import { FLOOR_FOCUS_RING } from './styles';
import { TimeScrubber } from './TimeScrubber';

import type { FloorPlanState } from './useFloorPlanState';

export type FloorPlanShellProps = {
  fp: FloorPlanState;
  clock: string;
};

/** Composes the floor plan from ops design-system primitives (standard page rhythm). */
export function FloorPlanShell({ fp, clock }: FloorPlanShellProps) {
  const summary = `${fp.stats.totalTables} tables · ${fp.stats.zoneCount} zones · ${fp.stats.capacity} covers`;
  const spotlightLabel = fp.spotlight
    ? (fp.legend.find((entry) => entry.state === fp.spotlight)?.label ?? 'filtered')
    : null;

  // lg (1024px) splits the layout: sticky aside at lg+, bottom Sheet below. Default true
  // assumes desktop on the server/first paint (the common ops surface) so desktop renders
  // pixel-identically with no portal flash; the aside also carries `hidden lg:block` so the
  // pre-effect render never flashes the aside on a phone.
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);

  // Dashed "could-join" hints: only when a party-holding table is selected and has
  // combine candidates (joinTargetsForSelected is already gated on both).
  const joinHints =
    fp.selectedNode && fp.joinTargetsForSelected.length > 0
      ? { fromId: fp.selectedNode.table.id, toIds: fp.joinTargetsForSelected.map((t) => t.id) }
      : null;

  return (
    <>
      <FloorPlanHeader venueName={fp.venueName} summary={summary} onRefresh={fp.refetch} />

      <FloorPlanCockpit stats={fp.stats} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19.5rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card
          className={cn(OPS_CARD_CLASS, 'min-w-0 overflow-hidden')}
          data-testid="floor-map-panel"
        >
          <CardHeader
            className={cn(
              OPS_CARD_HEADER_CLASS,
              'flex flex-row flex-wrap items-center gap-x-3 gap-y-2 space-y-0',
            )}
          >
            <CardTitle className="text-sm" role="heading" aria-level={2}>
              Floor map
            </CardTitle>
            <span aria-hidden className="hidden h-px flex-1 bg-border sm:block" />
            <span className="text-xs tabular-nums text-muted-foreground">Showing {clock}</span>
            {fp.scrubbing ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={fp.backToNow}
                className={cn('h-8 gap-1.5', FLOOR_FOCUS_RING)}
              >
                <RotateCcw className="size-3.5" /> Back to now
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className={OPS_CARD_CONTENT_CLASS}>
            <FloorPlanCanvas
              nodes={fp.nodes}
              joinGroups={fp.joinGroups}
              bounds={fp.bounds}
              canEdit={fp.canEdit}
              timezone={fp.timezone}
              joinHints={joinHints}
              onSelectTable={fp.selectTable}
              onPreviewDrag={fp.previewDrag}
              onCommitDrag={fp.commitDrag}
            />
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div
                  role="heading"
                  aria-level={3}
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Service states
                </div>
                <div className="mt-0.5 text-sm text-foreground">
                  {fp.stats.openTables} open · {fp.stats.occupancyPct}% seated capacity
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                {spotlightLabel ? (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={fp.clearSpotlight}
                    aria-label={`Showing ${spotlightLabel}. Clear status filter`}
                    className={cn(
                      'h-8 w-fit gap-1.5 border-primary/30 bg-primary/10 px-2.5 text-primary hover:bg-primary/15',
                      FLOOR_FOCUS_RING,
                    )}
                  >
                    Showing {spotlightLabel}
                    <X className="size-3.5" />
                  </Button>
                ) : null}
                <FloorPlanLegendFilter
                  legend={fp.legend}
                  spotlight={fp.spotlight}
                  onToggle={fp.toggleSpotlight}
                />
              </div>
            </div>
            <Separator className="my-4" />
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
          </CardContent>
        </Card>

        {/* Desktop: sticky right-column detail. `hidden lg:block` keeps the pre-effect render
            (isDesktop defaults true) from flashing the aside under the map on a phone. */}
        {isDesktop ? (
          <div className="hidden lg:sticky lg:top-4 lg:block lg:self-start">
            <FloorPlanDetailPanel
              variant="aside"
              open={false}
              selectedNode={fp.selectedNode}
              joinGroup={fp.joinGroupForSelected}
              joinTargets={fp.joinTargetsForSelected}
              zones={fp.zones}
              timezone={fp.timezone}
              isSeating={fp.isSeating}
              isClearing={fp.isClearing}
              onClose={fp.clearSelection}
              onSeatParty={fp.seatParty}
              onClearTable={fp.clearTable}
              onMarkNoShow={fp.markNoShowParty}
              onSplit={fp.splitTable}
              onJoin={fp.joinTables}
            />
          </div>
        ) : null}
      </div>

      {/* Mobile/tablet: the same panel as a bottom Sheet that opens on selection. */}
      {!isDesktop ? (
        <FloorPlanDetailPanel
          variant="sheet"
          open={fp.selectedNode != null}
          selectedNode={fp.selectedNode}
          joinGroup={fp.joinGroupForSelected}
          joinTargets={fp.joinTargetsForSelected}
          zones={fp.zones}
          timezone={fp.timezone}
          isSeating={fp.isSeating}
          isClearing={fp.isClearing}
          onClose={fp.clearSelection}
          onSeatParty={fp.seatParty}
          onClearTable={fp.clearTable}
          onMarkNoShow={fp.markNoShowParty}
          onSplit={fp.splitTable}
          onJoin={fp.joinTables}
        />
      ) : null}
    </>
  );
}
