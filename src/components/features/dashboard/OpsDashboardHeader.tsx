'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMinimumDelay } from '@/hooks/use-minimum-delay';
import { cn } from '@/lib/utils';

import { ConnectionStatusBeacon } from './ConnectionStatusBeacon';
import { HeatmapCalendar } from './HeatmapCalendar';
import { OpsPageHeader } from '../ops-shell/patterns/OpsPageHeader';

import type { OpsBookingHeatmap, OpsTodayBookingsSummary } from '@/types/ops';
import type { Ref } from 'react';

export type OpsDashboardHeaderProps = {
  headerSwipeRef: Ref<HTMLElement>;
  guestStats: { upcoming: number; seated: number };
  summary: OpsTodayBookingsSummary;
  selectedDate: string;
  isRefetching: boolean;
  isSummaryLoading?: boolean;
  initialNowIso: string;
  dataUpdatedAt?: number | null;
  realtimeEnabled?: boolean;
  realtimeHealthy?: boolean;
  isPolling?: boolean;
  hasSummaryError?: boolean;
  heatmap?: OpsBookingHeatmap;
  heatmapLoading?: boolean;
  onCalendarOpenChange: (open: boolean) => void;
  onSelectDate: (date: string) => void;
  onShiftDate: (days: number) => void;
  onPrevDate: () => void;
  onNextDate: () => void;
};

export function OpsDashboardHeader({
  headerSwipeRef,
  guestStats,
  summary,
  selectedDate,
  isRefetching,
  isSummaryLoading = false,
  initialNowIso,
  dataUpdatedAt,
  realtimeEnabled,
  realtimeHealthy,
  isPolling,
  hasSummaryError,
  heatmap,
  heatmapLoading,
  onCalendarOpenChange,
  onSelectDate,
  onShiftDate,
  onPrevDate,
  onNextDate,
}: OpsDashboardHeaderProps) {
  const showRefetching = useMinimumDelay(isRefetching, { delayMs: 120, minDurationMs: 250 });
  const subtitle = (
    <div
      className={cn(
        'text-xs transition-opacity duration-300 sm:text-sm',
        showRefetching && 'opacity-50',
      )}
    >
      {isSummaryLoading ? (
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-32 sm:w-40" />
          <Skeleton className="h-4 w-24 sm:w-32" />
          <Skeleton className="h-4 w-16 sm:w-20" />
        </div>
      ) : (
        <>
          <span className="font-semibold text-foreground">{guestStats.upcoming} guests</span>{' '}
          expecting arrival
          <span className="mx-1.5 text-muted-foreground/50">·</span>
          <span className="font-semibold text-foreground">{guestStats.seated} seated</span> now
          {showRefetching ? (
            <span className="ml-2 animate-pulse text-xs text-primary">(Updating…)</span>
          ) : null}
        </>
      )}
    </div>
  );

  const serviceMeta = isSummaryLoading ? (
    <>
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-6 w-24 rounded-full" />
    </>
  ) : (
    (() => {
      const totalBookings = summary.totals.total;
      const totalCovers = summary.totals.covers;
      return totalBookings > 0 ? (
        <>
          <Badge
            variant="secondary"
            className="gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-primary transition-[transform,box-shadow] duration-200 ease-out hover:scale-105 hover:shadow-md active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            {totalBookings} {totalBookings === 1 ? 'booking' : 'bookings'}
          </Badge>
          <Badge
            variant="secondary"
            className="gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-primary transition-[transform,box-shadow] duration-200 ease-out hover:scale-105 hover:shadow-md active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            {totalCovers} {totalCovers === 1 ? 'cover' : 'covers'}
          </Badge>
        </>
      ) : (
        <Badge
          variant="secondary"
          className="gap-1.5 px-2.5 py-1 text-[11px] font-medium sm:px-3 sm:py-1.5 sm:text-xs"
        >
          No bookings
        </Badge>
      );
    })()
  );

  return (
    <OpsPageHeader
      className="gap-3 sm:gap-4 xl:items-end"
      title="Operations"
      titleClassName="lg:text-4xl"
      subtitle={subtitle}
      meta={
        <ConnectionStatusBeacon
          initialNowIso={initialNowIso}
          dataUpdatedAt={dataUpdatedAt}
          realtimeEnabled={realtimeEnabled}
          realtimeHealthy={realtimeHealthy}
          isPolling={isPolling}
          isSummaryLoading={isSummaryLoading}
          hasSummaryError={hasSummaryError}
        />
      }
      headerRef={headerSwipeRef}
      secondaryActions={
        <div className="flex flex-col gap-3 sm:gap-4 xl:items-end">
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 sm:justify-start xl:justify-end">
            <Badge
              variant="outline"
              className="gap-1 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors duration-200 ease-out motion-reduce:transition-none sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
            >
              Service Date
            </Badge>
            {serviceMeta}
          </div>

          <div className="relative flex items-center justify-center gap-1.5 sm:gap-2 sm:justify-start xl:justify-end">
            <div
              className="pointer-events-none absolute left-0 flex items-center opacity-20 animate-pulse sm:opacity-30 xl:hidden"
              aria-hidden="true"
            >
              <ChevronsLeft className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/80 p-1 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md sm:rounded-xl sm:p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onPrevDate}
                className="size-10 text-muted-foreground hover:text-foreground active:scale-95 motion-reduce:active:scale-100 sm:size-9"
                aria-label="Previous day"
              >
                <ChevronLeft aria-hidden />
              </Button>

              <HeatmapCalendar
                summary={summary}
                heatmap={heatmap}
                selectedDate={selectedDate}
                onSelectDate={onSelectDate}
                onShiftDate={onShiftDate}
                isLoading={heatmapLoading}
                onOpenChange={onCalendarOpenChange}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onNextDate}
                className="size-10 text-muted-foreground hover:text-foreground active:scale-95 motion-reduce:active:scale-100 sm:size-9"
                aria-label="Next day"
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>

            <div
              className="pointer-events-none absolute right-0 flex items-center opacity-20 animate-pulse sm:opacity-30 xl:hidden"
              aria-hidden="true"
            >
              <ChevronsRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      }
    />
  );
}
