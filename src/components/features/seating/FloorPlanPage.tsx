'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  LayoutTemplate,
  Loader2,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useMemo, useState } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { queryKeys } from '@/lib/query/keys';

import { FloorCanvas } from './floor-plan/components/FloorCanvas';
import { TableInspector } from './floor-plan/components/TableInspector';
import { useFloorPlanTables } from './floor-plan/hooks/useFloorPlanTables';
import { useFloorPlanTimelineConfig } from './floor-plan/hooks/useFloorPlanTimelineConfig';
import { usePanZoom } from './floor-plan/hooks/usePanZoom';
import { parseLocalDateOnly, formatTimeParam } from './floor-plan/lib/date';

export default function FloorPlanPage() {
  const opsPath = useCallback((segment: string) => `/app${segment}`, []);
  const router = useRouter();
  const { activeRestaurantId } = useOpsSession();
  const isOnline = useOnlineStatus();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const tableService = useTableInventoryService();
  const zoneService = useZoneService();

  const [currentTimeVal, setCurrentTimeVal] = useState(19 * 60 + 30);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(() => new Date());
  const selectedDate = useMemo(
    () => (date ? format(date, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0]),
    [date],
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [isLaunchingBooking, setIsLaunchingBooking] = useState(false);
  const [search, setSearch] = useState('');
  const hoursQuery = useOpsOperatingHours(activeRestaurantId);
  const periodsQuery = useOpsServicePeriods(activeRestaurantId);
  const profileQuery = useOpsRestaurantDetails(activeRestaurantId);
  const operatingData = useMemo(() => {
    if (!hoursQuery.data || !periodsQuery.data || !profileQuery.data) return undefined;
    return { hours: hoursQuery.data, periods: periodsQuery.data, profile: profileQuery.data };
  }, [hoursQuery.data, periodsQuery.data, profileQuery.data]);
  const timelineConfig = useFloorPlanTimelineConfig(operatingData, selectedDate);
  // Zones
  const { data: zones = [] } = useQuery({
    queryKey: activeRestaurantId ? queryKeys.opsTables.zones(activeRestaurantId) : ['ops', 'zones', 'disabled'],
    queryFn: async () => {
      if (!activeRestaurantId) throw new Error('No restaurant ID');
      return zoneService.list(activeRestaurantId);
    },
    enabled: !!activeRestaurantId,
  });

  const selectedZoneLabel = useMemo(() => {
    if (selectedZoneId === 'all') return 'All zones';
    return zones.find((zone) => zone.id === selectedZoneId)?.name ?? 'Selected zone';
  }, [selectedZoneId, zones]);

  // Tables (layout)
  const { data: tablesListResult, isLoading: isLoadingTables } = useQuery({
    queryKey: activeRestaurantId
      ? queryKeys.opsTables.list(activeRestaurantId, { includeSummary: false })
      : ['ops', 'tables', 'disabled'],
    queryFn: async () => {
      if (!activeRestaurantId) throw new Error('No restaurant ID');
      return tableService.list(activeRestaurantId, { includeSummary: false });
    },
    enabled: !!activeRestaurantId,
  });

  const tables = useMemo(() => tablesListResult?.tables ?? [], [tablesListResult?.tables]);

  // Timeline (status)
  const { data: timelineData, isLoading: isLoadingTimeline } = useOpsTableTimeline({
    restaurantId: activeRestaurantId,
    date: selectedDate,
    includeSummary: false,
    enabled: !!activeRestaurantId,
  });

  const currentTimestampMs = useMemo(() => {
    return parseLocalDateOnly(selectedDate).getTime() + currentTimeVal * 60_000;
  }, [currentTimeVal, selectedDate]);

  const timeString = useMemo(() => {
    return new Date(currentTimestampMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }, [currentTimestampMs]);

  const timeParam = useMemo(() => formatTimeParam(currentTimestampMs), [currentTimestampMs]);

  const canStartPan = useCallback((target: HTMLElement | null) => {
    if (!target) return false;
    if (target.closest('[data-table-id]')) return false;
    if (target.closest('[data-prevent-canvas-pan]')) return false;
    if (target.closest('button, input, select, textarea, a, [role="button"], [role="slider"]')) return false;
    return true;
  }, []);

  const {
    zoom,
    pan,
    isDragging,
    hasDraggedRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    zoomIn,
    zoomOut,
    panBy,
    resetView,
  } = usePanZoom({
    initialZoom: 0.75,
    initialPan: { x: 0, y: 0 },
    canStartPan,
    onPanStart: () => setSelectedTableId(null),
  });

  const tablesForDisplay = useFloorPlanTables({
    tables,
    timeline: timelineData,
    timelineLoading: isLoadingTimeline && !timelineData,
    currentTimestampMs,
    selectedZoneId,
  });

  const filteredTables = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tablesForDisplay;

    return tablesForDisplay.filter((table) => {
      const numberMatch = table.tableNumber.toLowerCase().includes(q);
      const partyMatch = table.partyName ? table.partyName.toLowerCase().includes(q) : false;
      const zoneMatch = table.zoneName ? table.zoneName.toLowerCase().includes(q) : false;
      return numberMatch || partyMatch || zoneMatch;
    });
  }, [search, tablesForDisplay]);

  const selectedTable = useMemo(() => {
    if (!selectedTableId) return null;
    return filteredTables.find((table) => table.id === selectedTableId) ?? null;
  }, [filteredTables, selectedTableId]);

  const histogramBars = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const wave = Math.sin(i / 5) * 18;
        const offset = (i % 6) * 3;
        const height = 34 + wave + offset;
        return Math.max(12, Math.min(88, Math.round(height)));
      }),
    [],
  );

  const clampTime = useCallback(
    (value: number) => Math.min(timelineConfig.max, Math.max(timelineConfig.min, value)),
    [timelineConfig.max, timelineConfig.min],
  );

  const snapToSlots = useCallback(
    (value: number) => {
      if (!timelineConfig.slotTimes || timelineConfig.slotTimes.length === 0) {
        return clampTime(value);
      }
      const clamped = clampTime(value);
      let nearest = timelineConfig.slotTimes[0];
      let minDiff = Math.abs(clamped - nearest);
      timelineConfig.slotTimes.forEach((slot) => {
        const diff = Math.abs(clamped - slot);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = slot;
        }
      });
      return nearest;
    },
    [clampTime, timelineConfig.slotTimes],
  );

  React.useEffect(() => {
    setCurrentTimeVal((current) => {
      const next = snapToSlots(current);
      return next === current ? current : next;
    });
  }, [snapToSlots]);

  const handleTimeChange = useCallback(
    (value: number) =>
      setCurrentTimeVal((current) => {
        const next = snapToSlots(value);
        return next === current ? current : next;
      }),
    [snapToSlots],
  );

  const handleTimeStep = useCallback(
    (delta: number) =>
      setCurrentTimeVal((current) => {
        if (!timelineConfig.slotTimes || timelineConfig.slotTimes.length === 0) {
          return clampTime(current + delta);
        }
        const slots = timelineConfig.slotTimes;
        const currentIndex = slots.reduce((closestIdx, slot, idx) => {
          const prevDiff = Math.abs(slots[closestIdx] - current);
          const nextDiff = Math.abs(slot - current);
          return nextDiff < prevDiff ? idx : closestIdx;
        }, 0);
        const nextIndex =
          delta > 0 ? Math.min(currentIndex + 1, slots.length - 1) : Math.max(currentIndex - 1, 0);
        return slots[nextIndex];
      }),
    [clampTime, timelineConfig.slotTimes],
  );

  const handleTableClick = useCallback(
    (id: string) => {
      if (!hasDraggedRef.current) {
        setSelectedTableId((current) => (id === current ? null : id));
      }
    },
    [hasDraggedRef],
  );

  const handleAddBooking = useCallback(
    (table = selectedTable) => {
      if (!isOnline) return;
      if (isLaunchingBooking) return;

      setIsLaunchingBooking(true);

      try {
        const params = new URLSearchParams();
        params.set('date', selectedDate);
        params.set('time', timeParam);

        if (table?.capacity) {
          params.set('partySize', table.capacity.toString());
        }

        router.push(`${opsPath('/new-bookings')}?${params.toString()}`);
      } catch (error) {
        console.error('[floor-plan] failed to open new booking', error);
        setIsLaunchingBooking(false);
      }
    },
    [isLaunchingBooking, isOnline, opsPath, router, selectedDate, selectedTable, timeParam],
  );

  const handleBrowseBookings = useCallback(
    (table = selectedTable) => {
      if (!isOnline) return;

      const params = new URLSearchParams();
      params.set('date', selectedDate);

      if (table) {
        params.set('tableId', table.id);
        params.set('tableLabel', `Table ${table.tableNumber}`);
        params.set('time', timeParam);
      }

      router.push(`${opsPath('/bookings')}?${params.toString()}`);
    },
    [isOnline, opsPath, router, selectedDate, selectedTable, timeParam],
  );

  if (!activeRestaurantId) {
    return (
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center px-4 py-10">
        <OpsEmptyState
          title="No restaurant selected"
          description="Select a restaurant to load the floor plan."
          icon={<LayoutTemplate className="h-6 w-6" aria-hidden />}
        />
      </div>
    );
  }

  // Tables define the physical layout; without them we can't render anything meaningful.
  // Timeline data is additive (live status) and can load in the background.
  if (isLoadingTables && tables.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center px-4 py-10">
        <OpsEmptyState
          title="Loading floor plan…"
          description="Fetching table layout."
          icon={<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />}
        />
      </div>
    );
  }

  const formattedDate = date ? format(date, 'MMM d, yyyy') : 'Today';

  const inspectorPanel = selectedTable ? (
    <TableInspector
      table={selectedTable}
      onClose={() => setSelectedTableId(null)}
      onAddBooking={() => handleAddBooking(selectedTable)}
      onBrowseBookings={() => handleBrowseBookings(selectedTable)}
      isOnline={isOnline}
      isLaunchingBooking={isLaunchingBooking}
      variant="panel"
    />
  ) : (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Table details</CardTitle>
        <CardDescription>Select a table to review bookings and actions.</CardDescription>
      </CardHeader>
    </Card>
  );

  const showEmptySearch = filteredTables.length === 0 && search.trim().length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-3 py-6 sm:px-6 lg:px-8">
      <OpsPageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutTemplate className="h-5 w-5" aria-hidden />
            </span>
            <span>Floor plan</span>
          </span>
        }
        subtitle="Manage table availability and jump into bookings quickly."
        meta={
          <>
            <Badge variant="secondary" className="rounded-md">
              {selectedZoneLabel}
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {formattedDate}
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {timeString}
            </Badge>
            {isLoadingTimeline ? (
              <Badge variant="outline" className="rounded-md">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Updating status…
                </span>
              </Badge>
            ) : null}
          </>
        }
        secondaryActions={
          <Button variant="outline" onClick={() => handleBrowseBookings()} disabled={!isOnline}>
            Browse bookings
          </Button>
        }
        primaryAction={
          <Button
            onClick={() => handleAddBooking()}
            disabled={!isOnline || isLaunchingBooking}
            aria-busy={isLaunchingBooking}
          >
            {isLaunchingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            New booking
          </Button>
        }
      />

      <OpsPageToolbar
        sticky={false}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <LayoutTemplate className="h-4 w-4" aria-hidden />
                  {selectedZoneLabel}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Zones</div>
                <div className="space-y-1">
                  <Button
                    type="button"
                    variant={selectedZoneId === 'all' ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSelectedZoneId('all')}
                  >
                    All zones
                  </Button>
                  {zones.map((zone) => (
                    <Button
                      key={zone.id}
                      type="button"
                      variant={selectedZoneId === zone.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedZoneId(zone.id)}
                    >
                      {zone.name}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" aria-hidden />
                  {formattedDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        }
        search={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              name="search"
              autoComplete="off"
              placeholder="Search guests, tables…"
              className="pl-9 focus-visible:ring-2 focus-visible:ring-primary/20"
              aria-label="Search guests or tables"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <FloorCanvas
            selectedZoneLabel={selectedZoneLabel}
            timeString={timeString}
            pan={pan}
            zoom={zoom}
            isDragging={isDragging}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onPanBy={panBy}
            onResetView={resetView}
            tables={filteredTables}
            selectedTableId={selectedTableId}
            onTableClick={handleTableClick}
            time={currentTimeVal}
            timelineConfig={timelineConfig}
            bars={histogramBars}
            onTimeChange={handleTimeChange}
            onTimeStep={handleTimeStep}
            emptySearchQuery={showEmptySearch ? search.trim() : null}
          />
        </div>
        <aside className="hidden lg:block">{inspectorPanel}</aside>
      </div>

      {!isDesktop ? (
        <Sheet
          open={Boolean(selectedTable)}
          onOpenChange={(open) => {
            if (!open) setSelectedTableId(null);
          }}
        >
          <SheetContent side="bottom" className="h-[85vh] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Table details</SheetTitle>
              <SheetDescription>Review table status and actions.</SheetDescription>
            </SheetHeader>
            <TableInspector
              table={selectedTable}
              onClose={() => setSelectedTableId(null)}
              onAddBooking={() => handleAddBooking(selectedTable)}
              onBrowseBookings={() => handleBrowseBookings(selectedTable)}
              isOnline={isOnline}
              isLaunchingBooking={isLaunchingBooking}
              variant="sheet"
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
