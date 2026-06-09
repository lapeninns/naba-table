'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useOpsSession } from '@/contexts/ops-session';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';

import {
  clampToServiceWindow,
  DEFAULT_STATUS_FILTERS,
  timeToPositionPx,
  toHHMM,
  type SelectedSegment,
  type TimelineService,
} from './tableTimelineDomain';

import type { TableTimelineSegmentState } from '@/types/ops';

type TimelineActionState = {
  releasing: boolean;
  error: string | null;
};

export function useTableTimelineController() {
  const { activeRestaurantId, activeMembership } = useOpsSession();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [service, setService] = useState<TimelineService>('all');
  const [search, setSearch] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);
  const [statusFilters, setStatusFilters] =
    useState<TableTimelineSegmentState[]>(DEFAULT_STATUS_FILTERS);
  const [actionState, setActionState] = useState<TimelineActionState>({
    releasing: false,
    error: null,
  });
  const [now, setNow] = useState<Date>(() => new Date());
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  const timelineQuery = useOpsTableTimeline({
    restaurantId: activeRestaurantId,
    date: selectedDate,
    zoneId: selectedZone,
    service,
  });

  const timeline = timelineQuery.data ?? null;

  useEffect(() => {
    if (timeline && !selectedDate) {
      setSelectedDate(timeline.date);
    }
  }, [timeline, selectedDate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!timeline?.window?.start || !timeline?.window?.end) return;
    const viewport = timelineScrollRef.current;
    if (!viewport) return;

    const start = toHHMM(timeline.window.start);
    const end = toHHMM(timeline.window.end);
    const nowHHMM = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const nowPx = clampToServiceWindow(timeToPositionPx(nowHHMM), start, end);
    const desired = Math.max(0, nowPx - viewport.clientWidth / 2);
    viewport.scrollLeft = desired;
    // only on initial timeline load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline?.window?.start, timeline?.window?.end]);

  const zones = useMemo(() => timeline?.summary?.zones ?? [], [timeline?.summary?.zones]);
  const statusFilterSet = useMemo(
    () => new Set<TableTimelineSegmentState>(statusFilters),
    [statusFilters],
  );
  const filteredTables = useMemo(() => {
    if (!timeline) return [];
    const query = search.trim().toLowerCase();
    return timeline.tables.filter((row) => {
      const matchesSearch =
        !query ||
        String(row.table.tableNumber ?? '')
          .toLowerCase()
          .includes(query) ||
        (row.table.zoneName ?? '').toLowerCase().includes(query);
      const hasVisibleSegments = row.segments.some((segment) => statusFilterSet.has(segment.state));
      return matchesSearch && hasVisibleSegments;
    });
  }, [timeline, search, statusFilterSet]);

  const selectedZoneName = useMemo(() => {
    if (!selectedZone) return null;
    const match = zones.find((zone) => zone.id === selectedZone);
    return match?.name ?? null;
  }, [selectedZone, zones]);

  const toggleStatusFilter = (status: TableTimelineSegmentState) => {
    setStatusFilters((prev) => {
      const next = prev.includes(status)
        ? prev.filter((value) => value !== status)
        : [...prev, status];
      return next.length > 0 ? next : DEFAULT_STATUS_FILTERS;
    });
  };

  const handleReleaseHold = async (holdId: string, bookingId: string | null) => {
    if (!holdId || !bookingId) {
      setActionState({
        releasing: false,
        error: 'Cannot release hold without a booking reference.',
      });
      return;
    }
    setActionState({ releasing: true, error: null });
    try {
      const response = await fetch('/api/staff/manual/hold', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId, bookingId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Unable to release hold');
      }
      await timelineQuery.refetch();
      setSelectedSegment(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to release hold';
      setActionState({ releasing: false, error: message });
      return;
    }
    setActionState({ releasing: false, error: null });
  };

  const closeSelectedSegment = () => {
    setActionState({ releasing: false, error: null });
    setSelectedSegment(null);
  };

  return {
    actionState,
    closeSelectedSegment,
    filteredTables,
    handleReleaseHold,
    hasActiveRestaurant: Boolean(activeMembership && activeRestaurantId),
    isRealtimeEnabled: true,
    now,
    search,
    selectedDate,
    selectedSegment,
    selectedZone,
    selectedZoneName,
    service,
    setSearch,
    setSelectedDate,
    setSelectedSegment,
    setSelectedZone,
    setService,
    statusFilters,
    timeline,
    timelineQuery,
    timelineScrollRef,
    toggleStatusFilter,
    zones,
  };
}
