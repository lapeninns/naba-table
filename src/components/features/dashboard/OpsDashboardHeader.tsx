'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

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
  isRefetching: boolean;
  isSummaryLoading?: boolean;
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
  isRefetching,
  isSummaryLoading = false,
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
    <div className={cn('text-xs transition-opacity duration-300 sm:text-sm', showRefetching && 'opacity-50')}>
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
            <span className="ml-2 animate-pulse text-xs text-amber-600">(Updating…)</span>
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition-[transform,box-shadow,background-color,color] duration-200 ease-out hover:scale-105 hover:shadow-md active:scale-95 dark:bg-blue-900/30 dark:text-blue-300 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:px-3 sm:py-1.5 sm:text-xs">
            {totalBookings} {totalBookings === 1 ? 'booking' : 'bookings'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-[transform,box-shadow,background-color,color] duration-200 ease-out hover:scale-105 hover:shadow-md active:scale-95 dark:bg-emerald-900/30 dark:text-emerald-300 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:px-3 sm:py-1.5 sm:text-xs">
            {totalCovers} {totalCovers === 1 ? 'cover' : 'covers'}
          </span>
        </>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 sm:px-3 sm:py-1.5 sm:text-xs">
          No bookings
        </span>
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
          dataUpdatedAt={dataUpdatedAt}
          realtimeEnabled={realtimeEnabled}
          realtimeHealthy={realtimeHealthy}
          isPolling={isPolling}
          isSummaryLoading={isSummaryLoading}
          hasSummaryError={hasSummaryError}
        />
      }
      ref={headerSwipeRef}
      secondaryActions={
        <div className="flex flex-col gap-3 sm:gap-4 xl:items-end">
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 sm:justify-start xl:justify-end">
            <div className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted motion-reduce:transition-none sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs">
              Service Date
            </div>
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
              <button
                type="button"
                onClick={onPrevDate}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-[transform,background-color,color,box-shadow] duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:active:scale-100 sm:h-9 sm:w-9"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>

              <HeatmapCalendar
                summary={summary}
                heatmap={heatmap}
                selectedDate={summary.date}
                onSelectDate={onSelectDate}
                onShiftDate={onShiftDate}
                isLoading={heatmapLoading}
                onOpenChange={onCalendarOpenChange}
              />

              <button
                type="button"
                onClick={onNextDate}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-[transform,background-color,color,box-shadow] duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:active:scale-100 sm:h-9 sm:w-9"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
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
