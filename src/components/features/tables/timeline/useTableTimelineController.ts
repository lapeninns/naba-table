'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useOpsSession } from '@/contexts/ops-session';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';
import { toUserMessage } from '@/lib/http/userMessage';
import { useReleaseTableHold } from '@src/hooks/ops/useReleaseTableHold';

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

const RELEASE_HOLD_ERROR_COPY = {
  copy: { FORBIDDEN: "You don't have permission to release holds for this restaurant." },
  fallback: 'The hold wasn’t released. Try again.',
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
  const releaseHold = useReleaseTableHold(activeRestaurantId ?? null);
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

  // Holds may be unbound (no booking), so only the hold id and the restaurant are needed.
  const handleReleaseHold = (holdId: string) => {
    if (!holdId || !activeRestaurantId) return;
    releaseHold.mutate(
      { restaurantId: activeRestaurantId, holdId },
      // The hook refetches the timeline; closing the dialog is this screen's decision.
      { onSuccess: () => setSelectedSegment(null) },
    );
  };

  const closeSelectedSegment = () => {
    releaseHold.reset();
    setSelectedSegment(null);
  };

  const actionState: TimelineActionState = {
    releasing: releaseHold.isPending,
    error: releaseHold.isError ? toUserMessage(releaseHold.error, RELEASE_HOLD_ERROR_COPY) : null,
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
