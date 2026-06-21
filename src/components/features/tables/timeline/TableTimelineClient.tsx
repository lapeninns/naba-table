'use client';

import { AlertCircle, Info } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';

import { TableTimelineGrid, TimelineSkeleton } from './TableTimelineGrid';
import { TableTimelineHeader } from './TableTimelineHeader';
import { TableTimelineSegmentDialog } from './TableTimelineSegmentDialog';
import { TableTimelineSidePanels } from './TableTimelineSidePanels';
import { TableTimelineSummaryCards } from './TableTimelineSummaryCards';
import { TableTimelineToolbar } from './TableTimelineToolbar';
import { useTableTimelineController } from './useTableTimelineController';

export function TableTimelineClient() {
  const timeline = useTableTimelineController();

  if (!timeline.hasActiveRestaurant) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Select a restaurant to view table capacity timeline.
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-[calc(100dvh-3rem)] bg-background pb-12">
        <TableTimelineHeader
          search={timeline.search}
          selectedDate={timeline.selectedDate}
          selectedZoneName={timeline.selectedZoneName}
          service={timeline.service}
          timelineWindow={timeline.timeline?.window}
          onSearchChange={timeline.setSearch}
          onSelectedDateChange={timeline.setSelectedDate}
        />

        <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
          <TableTimelineSummaryCards />

          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 flex-1">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <TableTimelineToolbar
                    dataUpdatedAt={timeline.timelineQuery.dataUpdatedAt}
                    isFetching={timeline.timelineQuery.isFetching}
                    selectedZone={timeline.selectedZone}
                    service={timeline.service}
                    statusFilters={timeline.statusFilters}
                    zones={timeline.zones}
                    onRefresh={() => timeline.timelineQuery.refetch()}
                    onSelectZone={timeline.setSelectedZone}
                    onServiceChange={timeline.setService}
                    onToggleStatusFilter={timeline.toggleStatusFilter}
                  />

                  {timeline.timelineQuery.isLoading ? (
                    <TimelineSkeleton />
                  ) : timeline.timeline ? (
                    <TableTimelineGrid
                      timeline={timeline.timeline}
                      tables={timeline.filteredTables}
                      onSelectSegment={(table, segment) =>
                        timeline.setSelectedSegment({ table, segment })
                      }
                      now={timeline.now}
                      scrollRef={timeline.timelineScrollRef}
                    />
                  ) : (
                    <div className="p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="size-4" />
                        Unable to load table timeline. Please try again.
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Info className="size-4" />
                      Drag blocks to reassign tables. Right-click for quick actions.
                    </div>
                    <div className="hidden sm:block">
                      Live updates {timeline.isRealtimeEnabled ? 'on' : 'polling'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <TableTimelineSidePanels />
          </div>

          <TableTimelineSegmentDialog
            selected={timeline.selectedSegment}
            onClose={timeline.closeSelectedSegment}
            onReleaseHold={timeline.handleReleaseHold}
            actionState={timeline.actionState}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}
